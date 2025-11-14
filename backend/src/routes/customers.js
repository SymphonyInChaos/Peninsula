import { Router } from "express";
import prisma from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(customers);
  } catch (error) {
    console.error("Failed to fetch customers", error);
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Failed to fetch customer", error);
    res.status(500).json({ message: "Failed to fetch customer" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const id = await generateNextId("c", "customer");

    const customer = await prisma.customer.create({
      data: {
        id,
        name,
        email: email ?? null,
        phone: phone ?? null,
      },
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error("Failed to create customer", error);
    res.status(500).json({ message: "Failed to create customer" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
    });

    res.json(customer);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Customer not found" });
    }

    console.error("Failed to update customer", error);
    res.status(500).json({ message: "Failed to update customer" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    // First, check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Delete all orders and their items that reference this customer, then delete the customer
    await prisma.$transaction(async (tx) => {
      // Find all orders for this customer
      const orders = await tx.order.findMany({
        where: { customerId: req.params.id },
        select: { id: true },
      });

      const orderIds = orders.map((order) => order.id);

      // Delete all order items for these orders
      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        });
      }

      // Delete all orders for this customer
      await tx.order.deleteMany({
        where: { customerId: req.params.id },
      });

      // Now delete the customer
      await tx.customer.delete({
        where: { id: req.params.id },
      });
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Customer not found" });
    }

    console.error("Failed to delete customer", error);
    res.status(500).json({ message: "Failed to delete customer" });
  }
});

export default router;

