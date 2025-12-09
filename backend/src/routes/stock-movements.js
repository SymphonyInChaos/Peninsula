import { Router } from "express";
import prisma from "../utils/db.js";
import { z } from "zod";

const router = Router();

// Validation schema for stock movement
const stockMovementSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  type: z.enum(["sale", "restock", "adjustment", "refund"], {
    errorMap: () => ({
      message: "Type must be sale, restock, adjustment, or refund",
    }),
  }),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  reason: z.string().optional(),
});

// =========== FIXED ROUTES FIRST ===========
// Get all stock movements with filters
router.get("/", async (req, res) => {
  try {
    const { type } = req.query;

    const where = {};

    // Filter by type
    if (type && type !== "all") {
      where.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response with product name
    const formattedMovements = movements.map((movement) => ({
      id: movement.id,
      productId: movement.productId,
      productName: movement.product?.name || "Unknown Product",
      type: movement.type,
      quantity: movement.quantity,
      oldStock: movement.oldStock,
      newStock: movement.newStock,
      reason: movement.reason,
      createdAt: movement.createdAt,
    }));

    res.json(formattedMovements);
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    res.status(500).json({ message: "Failed to fetch stock movements" });
  }
});

// Get stock movement summary report - MUST BE BEFORE /:id
router.get("/report/summary", async (req, res) => {
  try {
    const movements = await prisma.stockMovement.findMany({
      include: {
        product: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate summaries
    const summary = {
      totalMovements: movements.length,
      totalSales: movements.filter((m) => m.type === "sale").length,
      totalRestocks: movements.filter((m) => m.type === "restock").length,
      totalAdjustments: movements.filter((m) => m.type === "adjustment").length,
      totalRefunds: movements.filter((m) => m.type === "refund").length,
      totalQuantitySold: movements
        .filter((m) => m.type === "sale")
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      totalQuantityRestocked: movements
        .filter((m) => m.type === "restock")
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      totalQuantityAdjusted: movements
        .filter((m) => m.type === "adjustment")
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
      totalQuantityRefunded: movements
        .filter((m) => m.type === "refund")
        .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
    };

    res.json(summary);
  } catch (error) {
    console.error("Error generating stock report:", error);
    res.status(500).json({ message: "Failed to generate stock report" });
  }
});

// Get product-specific stock history - BEFORE /:id
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      product: {
        id: product.id,
        name: product.name,
        currentStock: product.stock,
      },
      movements,
    });
  } catch (error) {
    console.error("Error fetching product stock history:", error);
    res.status(500).json({ message: "Failed to fetch product stock history" });
  }
});

// Seed sample stock data - FIXED NAME to match frontend
router.post("/seed-stock-data", async (req, res) => {
  try {
    // Get some products to create movements for
    const products = await prisma.product.findMany({
      take: 10,
    });

    if (products.length === 0) {
      return res.status(400).json({
        message: "No products found. Please create products first.",
      });
    }

    const sampleMovements = [];
    const movementTypes = ["sale", "restock", "adjustment", "refund"];
    const reasons = [
      "Customer purchase",
      "Supplier delivery",
      "Inventory correction",
      "Damaged goods",
      "Promotional restock",
      "Stock take adjustment",
      "Customer return",
      "Expired items",
    ];

    // Generate sample movements for last 30 days
    for (let i = 0; i < 50; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const type =
        movementTypes[Math.floor(Math.random() * movementTypes.length)];
      const quantity = Math.floor(Math.random() * 20) + 1;
      const reason = reasons[Math.floor(Math.random() * reasons.length)];

      // Random date within last 30 days
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      date.setHours(Math.floor(Math.random() * 24));
      date.setMinutes(Math.floor(Math.random() * 60));

      // Calculate stock changes
      const oldStock = product.stock;
      let newStock = oldStock;

      if (type === "sale" || type === "adjustment") {
        newStock = Math.max(0, oldStock - quantity);
      } else {
        newStock = oldStock + quantity;
      }

      sampleMovements.push({
        productId: product.id,
        type,
        quantity,
        oldStock,
        newStock,
        reason,
        createdAt: date,
      });
    }

    // Create all sample movements in a transaction
    await prisma.$transaction([
      ...sampleMovements.map((movement) =>
        prisma.stockMovement.create({ data: movement })
      ),
    ]);

    res.json({
      message: "Sample stock data seeded successfully",
      movementsCreated: sampleMovements.length,
    });
  } catch (error) {
    console.error("Error seeding sample data:", error);
    res.status(500).json({ message: "Failed to seed sample data" });
  }
});

// =========== DYNAMIC ROUTES LAST ===========
// Get a specific stock movement - THIS MUST BE LAST
router.get("/:id", async (req, res) => {
  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id: req.params.id },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            category: true,
          },
        },
      },
    });

    if (!movement) {
      return res.status(404).json({ message: "Stock movement not found" });
    }

    // Format response
    const formattedMovement = {
      ...movement,
      productName: movement.product?.name || "Unknown Product",
    };

    res.json(formattedMovement);
  } catch (error) {
    console.error("Error fetching stock movement:", error);
    res.status(500).json({ message: "Failed to fetch stock movement" });
  }
});

// Create a new stock movement
router.post("/", async (req, res) => {
  try {
    // Validate input
    const validatedData = stockMovementSchema.parse(req.body);

    const { productId, type, quantity, reason } = validatedData;

    // Get current product stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Calculate new stock based on type
    let newStock = product.stock;
    const oldStock = product.stock;

    switch (type) {
      case "sale":
      case "adjustment":
        // Decrease stock
        if (product.stock < quantity) {
          return res.status(400).json({
            message: "Insufficient stock",
            currentStock: product.stock,
            requested: quantity,
          });
        }
        newStock = product.stock - quantity;
        break;

      case "restock":
      case "refund":
        // Increase stock
        newStock = product.stock + quantity;
        break;
    }

    // Create stock movement and update product in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update product stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      // Create stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type,
          quantity,
          oldStock,
          newStock,
          reason: reason || `Stock ${type}`,
        },
      });

      return movement;
    });

    // Get the created movement with product info
    const createdMovement = await prisma.stockMovement.findUnique({
      where: { id: result.id },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            category: true,
          },
        },
      },
    });

    res.status(201).json({
      ...createdMovement,
      productName: createdMovement.product?.name || "Unknown Product",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    console.error("Error creating stock movement:", error);
    res.status(500).json({ message: "Failed to create stock movement" });
  }
});

// Helper function to calculate stock change over days
async function calculateStockChange(productId, days) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const movements = await prisma.stockMovement.findMany({
    where: {
      productId,
      createdAt: { gte: date },
    },
  });

  return movements.reduce((change, movement) => {
    if (movement.type === "sale" || movement.type === "adjustment") {
      return change - movement.quantity;
    }
    return change + movement.quantity;
  }, 0);
}

// Export for use in main app
export default router;
