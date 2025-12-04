import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const globalPrisma = globalThis;

if (!globalPrisma.__prisma) {
  globalPrisma.__prisma = new PrismaClient();
}

const prisma = globalPrisma.__prisma;

// Enhanced Validation Schemas with strict rules
export const CustomerSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: z
    .string()
    .email("Invalid email format")
    .max(100, "Email too long")
    .nullable()
    .optional()
    .refine(async (email) => {
      if (!email) return true;
      const existing = await prisma.customer.findFirst({
        where: { email },
      });
      return !existing;
    }, "Email already exists"),
  phone: z
    .string()
    .max(20, "Phone number too long")
    .regex(/^[\d\s\-\+\(\)]+$/, "Invalid phone number format")
    .nullable()
    .optional()
    .refine(async (phone) => {
      if (!phone) return true;
      const existing = await prisma.customer.findFirst({
        where: { phone },
      });
      return !existing;
    }, "Phone number already exists"),
});

export const ProductSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .refine(async (name, ctx) => {
      const existing = await prisma.product.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
          ...(ctx.parent.id ? { NOT: { id: ctx.parent.id } } : {}),
        },
      });
      return !existing;
    }, "Product name already exists"),
  description: z
    .string()
    .max(500, "Description too long")
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
});

export const OrderItemSchema = z
  .object({
    productId: z.string().min(1, "Product ID is required"),
    qty: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1")
      .max(1000, "Quantity too high"),
    price: z.number().positive("Price must be positive").optional(),
  })
  .refine(async (data) => {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    return product && product.stock >= data.qty;
  }, "Insufficient stock for this product");

export const OrderSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().nullable().optional(),
  items: z
    .array(OrderItemSchema)
    .min(1, "Order must have at least one item")
    .max(50, "Order cannot have more than 50 items"),
  total: z.number().positive("Total must be positive").optional(),
});

export const UserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]).default("STAFF"),
});

// Enhanced validation functions with async support
export const validateCustomer = async (data) => {
  return await CustomerSchema.parseAsync(data);
};

export const validateProduct = async (data) => {
  return await ProductSchema.parseAsync(data);
};

export const validateOrder = async (data) => {
  return await OrderSchema.parseAsync(data);
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
