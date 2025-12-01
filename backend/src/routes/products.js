// routes/products.js
import { Router } from "express";
import prisma, { validateProduct } from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";

const router = Router();

// Get all products
router.get("/", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (error) {
    console.error("Failed to fetch products", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Get product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Failed to fetch product", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Create product
router.post("/", async (req, res) => {
  try {
    const {
      name,
      price,
      stock,
      description,
      category,
      unit,
      purchasePrice,
      expiryDate,
    } = req.body;

    // Validate input
    const validatedData = validateProduct({
      name,
      price: Number(price),
      stock: Number(stock),
      description: description || null,
      category: category || null,
      unit: unit || null,
      purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      expiryDate: expiryDate || null,
    });

    const id = await generateNextId("p", "product");

    const product = await prisma.product.create({
      data: {
        id,
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        unit: validatedData.unit,
        purchasePrice: validatedData.purchasePrice,
        price: validatedData.price,
        stock: validatedData.stock,
        expiryDate: validatedData.expiryDate
          ? new Date(validatedData.expiryDate)
          : null,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    console.error("Failed to create product", error);
    res.status(500).json({ message: "Failed to create product" });
  }
});

// Update product
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      price,
      stock,
      description,
      category,
      unit,
      purchasePrice,
      expiryDate,
    } = req.body;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Validate input
    const validatedData = validateProduct({
      name: name !== undefined ? name : existingProduct.name,
      price: price !== undefined ? Number(price) : existingProduct.price,
      stock: stock !== undefined ? Number(stock) : existingProduct.stock,
      description:
        description !== undefined ? description : existingProduct.description,
      category: category !== undefined ? category : existingProduct.category,
      unit: unit !== undefined ? unit : existingProduct.unit,
      purchasePrice:
        purchasePrice !== undefined
          ? Number(purchasePrice)
          : existingProduct.purchasePrice,
      expiryDate:
        expiryDate !== undefined
          ? expiryDate
          : existingProduct.expiryDate?.toISOString(),
    });

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        unit: validatedData.unit,
        purchasePrice: validatedData.purchasePrice,
        price: validatedData.price,
        stock: validatedData.stock,
        expiryDate: validatedData.expiryDate
          ? new Date(validatedData.expiryDate)
          : null,
      },
    });

    res.json(product);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ message: "Product not found" });
    }

    console.error("Failed to update product", error);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// Update stock only
router.patch("/:id/stock", async (req, res) => {
  try {
    const { stock, operation = "SET" } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    let newStock;
    switch (operation) {
      case "INCREMENT":
        newStock = existingProduct.stock + Number(stock);
        break;
      case "DECREMENT":
        newStock = existingProduct.stock - Number(stock);
        if (newStock < 0) {
          return res.status(400).json({
            message: "Cannot decrement stock below zero",
            currentStock: existingProduct.stock,
            requestedDecrement: stock,
          });
        }
        break;
      case "SET":
      default:
        if (stock < 0) {
          return res.status(400).json({
            message: "Stock cannot be negative",
            requestedStock: stock,
          });
        }
        newStock = Number(stock);
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { stock: newStock },
    });

    res.json({
      message: `Stock ${operation.toLowerCase()}ed successfully`,
      data: {
        previousStock: existingProduct.stock,
        newStock: product.stock,
        operation,
      },
    });
  } catch (error) {
    console.error("Failed to update stock", error);
    res.status(500).json({ message: "Failed to update stock" });
  }
});

// Delete product
router.delete("/:id", async (req, res) => {
  try {
    const existingProduct = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if product is in any orders
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: req.params.id },
      take: 1,
    });

    if (orderItems.length > 0) {
      return res.status(400).json({
        message: "Cannot delete product that is part of existing orders",
      });
    }

    await prisma.product.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Product not found" });
    }

    console.error("Failed to delete product", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// Get low stock products
router.get("/inventory/low-stock", async (req, res) => {
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
      data: lowStockProducts,
      threshold,
      count: lowStockProducts.length,
    });
  } catch (error) {
    console.error("Failed to fetch low stock products", error);
    res.status(500).json({ message: "Failed to fetch low stock products" });
  }
});

export default router;
