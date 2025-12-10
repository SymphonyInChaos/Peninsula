// utils/db.js
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const globalPrisma = globalThis;

if (!globalPrisma.__prisma) {
  globalPrisma.__prisma = new PrismaClient();
}

const prisma = globalPrisma.__prisma;

// Order Status Constants
export const ORDER_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

export const ORDER_STATUS_FLOW = {
  [ORDER_STATUSES.PENDING]: [
    ORDER_STATUSES.CONFIRMED,
    ORDER_STATUSES.CANCELLED,
  ],
  [ORDER_STATUSES.CONFIRMED]: [
    ORDER_STATUSES.PROCESSING,
    ORDER_STATUSES.CANCELLED,
  ],
  [ORDER_STATUSES.PROCESSING]: [
    ORDER_STATUSES.COMPLETED,
    ORDER_STATUSES.CANCELLED,
  ],
  [ORDER_STATUSES.COMPLETED]: [ORDER_STATUSES.REFUNDED],
  [ORDER_STATUSES.CANCELLED]: [],
  [ORDER_STATUSES.REFUNDED]: [],
};

// Validate status transition
export const validateStatusTransition = (currentStatus, newStatus) => {
  if (!currentStatus) return true; // New order, can start with any valid status

  const allowedTransitions = ORDER_STATUS_FLOW[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

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
  altPhone: z
    .string()
    .max(20, "Alternative phone too long")
    .nullable()
    .optional(),
  tags: z.array(z.string()).optional().default([]),
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
  costPrice: z
    .number()
    .positive("Cost price must be positive")
    .nullable()
    .optional(),
  sku: z.string().max(50, "SKU too long").nullable().optional(),
  isActive: z.boolean().optional().default(true),
  minStockLevel: z
    .number()
    .int("Minimum stock level must be an integer")
    .min(0, "Minimum stock level cannot be negative")
    .optional()
    .default(5),
  reorderPoint: z
    .number()
    .int("Reorder point must be an integer")
    .min(0, "Reorder point cannot be negative")
    .optional()
    .default(10),
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
  paymentMethod: z.string().optional().default("cash"),
  status: z
    .enum(Object.values(ORDER_STATUSES))
    .optional()
    .default(ORDER_STATUSES.PENDING),
  paymentReference: z.string().nullable().optional(),
  cashierId: z.string().nullable().optional(),
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

// Get order summary for dashboard
export const getOrderSummary = async (startDate, endDate) => {
  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      total: true,
      status: true,
      paymentMethod: true,
      customerId: true,
      createdAt: true,
    },
  });

  const summary = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
    byStatus: orders.reduce((acc, order) => {
      const status = order.status || "pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    byPaymentMethod: orders.reduce((acc, order) => {
      const method = order.paymentMethod || "cash";
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {}),
    byChannel: {
      online: orders.filter((order) => order.customerId).length,
      offline: orders.filter((order) => !order.customerId).length,
    },
  };

  return summary;
};

export default prisma;
