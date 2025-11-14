import { Router } from "express";
import prisma from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";

const router = Router();

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

router.post("/", async (req, res) => {
  try {
    const { name, price, stock } = req.body;

    if (!name || price === undefined || stock === undefined) {
      return res
        .status(400)
        .json({ message: "Name, price and stock are required" });
    }

    const id = await generateNextId("p", "product");

    const product = await prisma.product.create({
      data: {
        id,
        name,
        price: Number(price),
        stock: Number(stock),
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Failed to create product", error);
    res.status(500).json({ message: "Failed to create product" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, price, stock } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(stock !== undefined ? { stock: Number(stock) } : {}),
      },
    });

    res.json(product);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Product not found" });
    }

    console.error("Failed to update product", error);
    res.status(500).json({ message: "Failed to update product" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    // First, check if product exists
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete all OrderItems that reference this product, then delete the product
    await prisma.$transaction(async (tx) => {
      // Delete all order items that reference this product
      await tx.orderItem.deleteMany({
        where: { productId: req.params.id },
      });

      // Now delete the product
      await tx.product.delete({
        where: { id: req.params.id },
      });
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Product not found" });
    }

    console.error("Failed to delete product", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

export default router;

