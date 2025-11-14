import { Router } from "express";
import prisma from "../utils/db.js";
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

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return res
        .status(400)
        .json({ message: "One or more products are invalid" });
    }

    const priceMap = new Map(products.map((product) => [product.id, product.price]));

    const total = normalizedItems.reduce(
      (acc, item) => acc + priceMap.get(item.productId) * item.qty,
      0
    );

    const id = await generateNextId("o", "order");

    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          id,
          customerId,
          total,
          items: {
            create: normalizedItems.map((item) => ({
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
    console.error("Failed to create order", error);
    res.status(500).json({ message: "Failed to create order" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { customerId, items } = req.body;

    const normalizedItems =
      items === undefined ? undefined : parseItems(items);

    if (items !== undefined && (!normalizedItems || normalizedItems.length === 0)) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: req.params.id },
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

        const priceMap = new Map(
          products.map((product) => [product.id, product.price])
        );

        const total = normalizedItems.reduce(
          (acc, item) => acc + priceMap.get(item.productId) * item.qty,
          0
        );

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

    console.error("Failed to update order", error);
    res.status(500).json({ message: "Failed to update order" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    // First, check if order exists
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Delete all OrderItems that reference this order, then delete the order
    await prisma.$transaction(async (tx) => {
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
