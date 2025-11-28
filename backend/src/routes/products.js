import { Router } from "express";
import prisma, {
  validateProduct,
  validateStockAvailability,
} from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";
import { AuditService } from "../services/auditService.js";
import { authenticate, authorize, permissions } from "../middleware/auth.js";
import {
  AppError,
  StockError,
  ValidationError,
} from "../middleware/errorHandler.js";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get all products
router.get("/", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get product by ID
router.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

// Create product - Only managers and admins
router.post("/", authorize("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const { name, price, stock, description } = req.body;

    // Validate input with enhanced validation
    const validatedData = await validateProduct({
      name,
      price: Number(price),
      stock: Number(stock),
      description: description || null,
    });

    const id = await generateNextId("p", "product");

    const product = await prisma.product.create({
      data: {
        id,
        name: validatedData.name,
        description: validatedData.description,
        price: validatedData.price,
        stock: validatedData.stock,
      },
    });

    // Audit log
    await AuditService.logProductChange(
      "CREATE",
      product.id,
      null,
      product,
      req.user.id,
      req.user.role,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      next(new ValidationError(error.errors));
    } else {
      next(error);
    }
  }
});

// Update product - Only managers and admins
router.put("/:id", authorize("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const { name, price, stock, description } = req.body;

    // Check if product exists and get current state for audit
    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existingProduct) {
      throw new AppError("Product not found", 404);
    }

    // Validate input
    const validatedData = await validateProduct({
      id: req.params.id, // Pass ID for duplicate check exclusion
      name: name !== undefined ? name : existingProduct.name,
      price: price !== undefined ? Number(price) : existingProduct.price,
      stock: stock !== undefined ? Number(stock) : existingProduct.stock,
      description:
        description !== undefined ? description : existingProduct.description,
    });

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: validatedData.name }),
        ...(description !== undefined && {
          description: validatedData.description,
        }),
        ...(price !== undefined && { price: validatedData.price }),
        ...(stock !== undefined && { stock: validatedData.stock }),
      },
    });

    // Audit log
    await AuditService.logProductChange(
      "UPDATE",
      product.id,
      existingProduct,
      product,
      req.user.id,
      req.user.role,
      req.ip
    );

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      next(new ValidationError(error.errors));
    } else if (error.code === "P2025") {
      next(new AppError("Product not found", 404));
    } else {
      next(error);
    }
  }
});

// Update stock only - Managers and admins
router.patch(
  "/:id/stock",
  authorize("ADMIN", "MANAGER"),
  async (req, res, next) => {
    try {
      const { stock, operation = "SET" } = req.body; // operation: SET, INCREMENT, DECREMENT

      if (typeof stock !== "number" || !Number.isInteger(stock)) {
        throw new ValidationError([
          {
            path: ["stock"],
            message: "Stock must be an integer",
          },
        ]);
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: req.params.id },
      });

      if (!existingProduct) {
        throw new AppError("Product not found", 404);
      }

      let newStock;
      switch (operation) {
        case "INCREMENT":
          newStock = existingProduct.stock + stock;
          break;
        case "DECREMENT":
          newStock = existingProduct.stock - stock;
          if (newStock < 0) {
            throw new StockError(
              "Cannot decrement stock below zero",
              req.params.id,
              stock,
              existingProduct.stock
            );
          }
          break;
        case "SET":
        default:
          if (stock < 0) {
            throw new StockError(
              "Stock cannot be negative",
              req.params.id,
              stock,
              existingProduct.stock
            );
          }
          newStock = stock;
      }

      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: { stock: newStock },
      });

      // Audit log for stock change
      await AuditService.logProductChange(
        "UPDATE_STOCK",
        product.id,
        { stock: existingProduct.stock },
        { stock: newStock },
        req.user.id,
        req.user.role,
        req.ip
      );

      res.json({
        success: true,
        message: `Stock ${operation.toLowerCase()}ed successfully`,
        data: {
          previousStock: existingProduct.stock,
          newStock: product.stock,
          operation,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete product - Only admins and managers with checks
router.delete("/:id", authorize("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existingProduct) {
      throw new AppError("Product not found", 404);
    }

    // Check if product is in any orders
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: req.params.id },
      take: 1,
    });

    if (orderItems.length > 0) {
      throw new AppError(
        "Cannot delete product that is part of existing orders. Consider archiving instead.",
        400
      );
    }

    await prisma.product.delete({
      where: { id: req.params.id },
    });

    // Audit log
    await AuditService.logProductChange(
      "DELETE",
      req.params.id,
      existingProduct,
      null,
      req.user.id,
      req.user.role,
      req.ip
    );

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

// Get low stock products
router.get("/inventory/low-stock", async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: {
          lte: threshold,
        },
      },
      orderBy: { stock: "asc" },
    });

    res.json({
      success: true,
      data: lowStockProducts,
      threshold,
      count: lowStockProducts.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
