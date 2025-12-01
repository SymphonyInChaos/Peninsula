// utils/db.js
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const globalPrisma = globalThis;

if (!globalPrisma.__prisma) {
  globalPrisma.__prisma = new PrismaClient();
}

const prisma = globalPrisma.__prisma;

// Enhanced Validation Schemas
export const CustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z
    .string()
    .email("Invalid email format")
    .max(100, "Email too long")
    .nullable()
    .optional(),
  phone: z.string().max(20, "Phone number too long").nullable().optional(),
});

export const ProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z
    .string()
    .max(500, "Description too long")
    .nullable()
    .optional(),
  category: z.string().max(50, "Category too long").nullable().optional(),
  unit: z.string().max(20, "Unit too long").nullable().optional(),
  purchasePrice: z
    .number()
    .positive("Purchase price must be positive")
    .nullable()
    .optional(),
  price: z
    .number()
    .positive("Price must be positive")
    .min(0.01, "Price must be at least 0.01")
    .max(999999.99, "Price too high"),
  stock: z
    .number()
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative")
    .max(999999, "Stock quantity too high"),
  expiryDate: z.string().nullable().optional(),
});

export const OrderItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(1000, "Quantity too high"),
});

export const OrderSchema = z.object({
  customerId: z.string().nullable().optional(),
  items: z
    .array(OrderItemSchema)
    .min(1, "Order must have at least one item")
    .max(50, "Order cannot have more than 50 items"),
});

export const UserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]).default("STAFF"),
});

// Synchronous validation functions
export const validateCustomer = (data) => {
  return CustomerSchema.parse(data);
};

export const validateProduct = (data) => {
  return ProductSchema.parse(data);
};

export const validateOrder = (data) => {
  return OrderSchema.parse(data);
};

export const validateUser = (data) => UserSchema.parse(data);

// Stock management utility
export const validateStockAvailability = async (productId, requestedQty) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  if (product.stock < requestedQty) {
    throw new Error(
      `Insufficient stock for ${product.name}. Requested: ${requestedQty}, Available: ${product.stock}`
    );
  }

  return product;
};

export default prisma;
