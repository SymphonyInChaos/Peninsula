import { Router } from "express";
import prisma, { validateOrder, OrderItemSchema } from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";

const router = Router();

const orderIncludes = {
  customer: true,
  items: {
    include: {
      product: true,
    },
  },
};

const parseItems = (items) => {
  if (!Array.isArray(items)) {
    return null;
  }

  const normalized = [];

  for (const raw of items) {
    const productId = raw?.productId;
    const qty = Number(raw?.qty ?? 0);

    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return null;
    }

    normalized.push({ productId: String(productId), qty });
  }

  return normalized;
};

router.get("/", async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: orderIncludes,
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error("Failed to fetch orders", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: orderIncludes,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Failed to fetch order", error);
    res.status(500).json({ message: "Failed to fetch order" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { customerId = null, items } = req.body;

    const normalizedItems = parseItems(items);

    if (!normalizedItems || normalizedItems.length === 0) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    // Validate order structure
    const validatedData = validateOrder({
      customerId,
      items: normalizedItems,
    });

    const productIds = [
      ...new Set(validatedData.items.map((item) => item.productId)),
    ];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return res
        .status(400)
        .json({ message: "One or more products are invalid" });
    }

    // Check stock availability
    const stockIssues = [];
    for (const item of validatedData.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.stock < item.qty) {
        stockIssues.push({
          product: product.name,
          requested: item.qty,
          available: product.stock,
        });
      }
    }

    if (stockIssues.length > 0) {
      return res.status(400).json({
        message: "Insufficient stock for some products",
        stockIssues,
      });
    }

    const priceMap = new Map(
      products.map((product) => [product.id, product.price])
    );

    const total = validatedData.items.reduce(
      (acc, item) => acc + priceMap.get(item.productId) * item.qty,
      0
    );

    const id = await generateNextId("o", "order");

    const order = await prisma.$transaction(async (tx) => {
      // Update product stocks
      for (const item of validatedData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.qty,
            },
          },
        });
      }

      return tx.order.create({
        data: {
          id,
          customerId: validatedData.customerId,
          total,
          items: {
            create: validatedData.items.map((item) => ({
              qty: item.qty,
              price: priceMap.get(item.productId),
              product: {
                connect: { id: item.productId },
              },
            })),
          },
        },
        include: orderIncludes,
      });
    });

    res.status(201).json(order);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    console.error("Failed to create order", error);
    res.status(500).json({ message: "Failed to create order" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { customerId, items } = req.body;

    const normalizedItems = items === undefined ? undefined : parseItems(items);

    if (
      items !== undefined &&
      (!normalizedItems || normalizedItems.length === 0)
    ) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    // Validate order structure if items are provided
    if (normalizedItems) {
      try {
        validateOrder({
          customerId: customerId !== undefined ? customerId : null,
          items: normalizedItems,
        });
      } catch (validationError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationError.errors,
        });
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });

      if (!existing) {
        return null;
      }

      let updateData = {};

      if (customerId !== undefined) {
        updateData.customerId = customerId ?? null;
      }

      if (normalizedItems !== undefined) {
        const productIds = [
          ...new Set(normalizedItems.map((item) => item.productId)),
        ];

        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
        });

        if (products.length !== productIds.length) {
          throw new Error("INVALID_PRODUCTS");
        }

        // Check stock availability (considering current order items)
        const currentProductQtys = new Map();
        for (const item of existing.items) {
          currentProductQtys.set(item.productId, item.qty);
        }

        const stockIssues = [];
        for (const item of normalizedItems) {
          const product = products.find((p) => p.id === item.productId);
          const currentQty = currentProductQtys.get(item.productId) || 0;
          const stockChange = item.qty - currentQty;

          if (product && product.stock < stockChange) {
            stockIssues.push({
              product: product.name,
              requestedChange: stockChange,
              available: product.stock,
            });
          }
        }

        if (stockIssues.length > 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const priceMap = new Map(
          products.map((product) => [product.id, product.price])
        );

        const total = normalizedItems.reduce(
          (acc, item) => acc + priceMap.get(item.productId) * item.qty,
          0
        );

        // Update product stocks
        for (const item of normalizedItems) {
          const currentQty = currentProductQtys.get(item.productId) || 0;
          const stockChange = item.qty - currentQty;

          if (stockChange !== 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: stockChange,
                },
              },
            });
          }
        }

        await tx.orderItem.deleteMany({
          where: { orderId: req.params.id },
        });

        updateData = {
          ...updateData,
          total,
          items: {
            create: normalizedItems.map((item) => ({
              qty: item.qty,
              price: priceMap.get(item.productId),
              product: { connect: { id: item.productId } },
            })),
          },
        };
      }

      if (Object.keys(updateData).length === 0) {
        return tx.order.findUnique({
          where: { id: req.params.id },
          include: orderIncludes,
        });
      }

      return tx.order.update({
        where: { id: req.params.id },
        data: updateData,
        include: orderIncludes,
      });
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    if (error.message === "INVALID_PRODUCTS") {
      return res
        .status(400)
        .json({ message: "One or more products are invalid" });
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      return res
        .status(400)
        .json({ message: "Insufficient stock for updated quantities" });
    }

    console.error("Failed to update order", error);
    res.status(500).json({ message: "Failed to update order" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    // First, check if order exists
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Restore product stock and delete order
    await prisma.$transaction(async (tx) => {
      // Restore product stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.qty,
            },
          },
        });
      }

      // Delete all order items for this order
      await tx.orderItem.deleteMany({
        where: { orderId: req.params.id },
      });

      // Now delete the order
      await tx.order.delete({
        where: { id: req.params.id },
      });
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Order not found" });
    }

    console.error("Failed to delete order", error);
    res.status(500).json({ message: "Failed to delete order" });
  }
});

export default router;
