// routes/orders.js
import { Router } from "express";
import prisma, { validateOrder, ORDER_STATUSES } from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";

const router = Router();

// Order Status Constants (matching db.js)
const ORDER_STATUS_FLOW = {
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
const validateStatusTransition = (currentStatus, newStatus) => {
  if (!currentStatus) return true; // New order, can start with any valid status

  const allowedTransitions = ORDER_STATUS_FLOW[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

// Order includes
const orderIncludes = {
  customer: true,
  items: {
    include: {
      product: true,
    },
  },
};

// Parse items
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

// ==================== ORDER CRUD ENDPOINTS ====================

// GET all orders with filters
router.get("/", async (req, res) => {
  try {
    const {
      status,
      customerId,
      startDate,
      endDate,
      limit = 50,
      page = 1,
      search,
      paymentMethod,
    } = req.query;

    const where = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { paymentReference: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderIncludes,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit) || 50,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Failed to fetch orders", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// GET single order
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                sku: true,
                category: true,
                stock: true,
              },
            },
          },
        },
        payments: true,
        refunds: true,
      },
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

// POST create order
router.post("/", async (req, res) => {
  try {
    const {
      customerId = null,
      items,
      paymentMethod = "cash",
      status = ORDER_STATUSES.PENDING,
      paymentReference = null,
      cashierId = null,
      notes,
    } = req.body;

    // Validate status
    if (!Object.values(ORDER_STATUSES).includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Valid statuses: ${Object.values(
          ORDER_STATUSES
        ).join(", ")}`,
      });
    }

    const normalizedItems = parseItems(items);

    if (!normalizedItems || normalizedItems.length === 0) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    // Validate payment method
    const validPaymentMethods = [
      "cash",
      "upi",
      "card",
      "other",
      "wallet",
      "qr",
    ];
    const normalizedPaymentMethod = validPaymentMethods.includes(
      paymentMethod.toLowerCase()
    )
      ? paymentMethod.toLowerCase()
      : "cash";

    // Validate order structure
    const validatedData = validateOrder({
      customerId,
      items: normalizedItems,
      paymentMethod: normalizedPaymentMethod,
      status,
      paymentReference,
      cashierId,
    });

    // If customerId is provided, check if customer exists
    if (customerId) {
      const customerExists = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customerExists) {
        return res.status(400).json({ message: "Customer not found" });
      }
    }

    // Check cashier if provided
    if (cashierId) {
      const cashierExists = await prisma.user.findUnique({
        where: { id: cashierId },
      });

      if (!cashierExists) {
        return res.status(400).json({ message: "Cashier not found" });
      }
    }

    const productIds = [
      ...new Set(normalizedItems.map((item) => item.productId)),
    ];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return res
        .status(400)
        .json({ message: "One or more products are invalid" });
    }

    // Check stock availability (only for non-cancelled/refunded orders)
    const stockIssues = [];
    if (
      status !== ORDER_STATUSES.CANCELLED &&
      status !== ORDER_STATUSES.REFUNDED
    ) {
      for (const item of normalizedItems) {
        const product = products.find((p) => p.id === item.productId);
        if (product && product.stock < item.qty) {
          stockIssues.push({
            product: product.name,
            requested: item.qty,
            available: product.stock,
          });
        }
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

    const total = normalizedItems.reduce(
      (acc, item) => acc + priceMap.get(item.productId) * item.qty,
      0
    );

    const id = await generateNextId("o", "order");

    const order = await prisma.$transaction(async (tx) => {
      // Update product stocks (only for non-cancelled/refunded orders)
      if (
        status !== ORDER_STATUSES.CANCELLED &&
        status !== ORDER_STATUSES.REFUNDED
      ) {
        for (const item of normalizedItems) {
          const product = products.find((p) => p.id === item.productId);
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.qty,
              },
            },
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "sale",
              quantity: item.qty,
              oldStock: product.stock,
              newStock: product.stock - item.qty,
              reason: `Order ${id}`,
            },
          });
        }
      }

      // Create payment record
      if (total > 0) {
        await tx.payment.create({
          data: {
            orderId: id,
            method: normalizedPaymentMethod,
            amount: total,
            reference: paymentReference,
          },
        });
      }

      return tx.order.create({
        data: {
          id,
          customerId: customerId || null,
          total,
          paymentMethod: normalizedPaymentMethod,
          status,
          paymentReference: paymentReference || null,
          cashierId: cashierId || null,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Order",
        entityId: order.id,
        newValues: order,
        userId: cashierId || "system",
        userRole: "SYSTEM",
      },
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

// PATCH update order status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, reason } = req.body;
    const { id } = req.params;

    // Validate status
    if (!Object.values(ORDER_STATUSES).includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Valid statuses: ${Object.values(
          ORDER_STATUSES
        ).join(", ")}`,
      });
    }

    // Get current order with items
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate status transition
    if (!validateStatusTransition(existingOrder.status, status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${existingOrder.status} to ${status}`,
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Handle stock adjustments based on status changes
      if (
        (existingOrder.status === ORDER_STATUSES.CANCELLED ||
          existingOrder.status === ORDER_STATUSES.REFUNDED) &&
        status !== ORDER_STATUSES.CANCELLED &&
        status !== ORDER_STATUSES.REFUNDED
      ) {
        // Restoring from cancelled/refunded - decrement stock
        for (const item of existingOrder.items) {
          const oldStock = item.product.stock;
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.qty,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "adjustment",
              quantity: item.qty,
              oldStock,
              newStock: oldStock - item.qty,
              reason: `Order ${id} status changed from ${existingOrder.status} to ${status}`,
            },
          });
        }
      } else if (
        (status === ORDER_STATUSES.CANCELLED ||
          status === ORDER_STATUSES.REFUNDED) &&
        existingOrder.status !== ORDER_STATUSES.CANCELLED &&
        existingOrder.status !== ORDER_STATUSES.REFUNDED
      ) {
        // Moving to cancelled/refunded - restore stock
        for (const item of existingOrder.items) {
          const oldStock = item.product.stock;
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.qty,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type:
                status === ORDER_STATUSES.REFUNDED ? "refund" : "adjustment",
              quantity: item.qty,
              oldStock,
              newStock: oldStock + item.qty,
              reason: `Order ${id} ${status}: ${
                reason || "No reason provided"
              }`,
            },
          });
        }

        // Create refund record if status is refunded
        if (status === ORDER_STATUSES.REFUNDED) {
          await tx.refund.create({
            data: {
              orderId: id,
              amount: existingOrder.total,
              reason: reason || "No reason provided",
            },
          });
        }
      }

      // Update order status
      return tx.order.update({
        where: { id },
        data: { status },
        include: orderIncludes,
      });
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_STATUS",
        entity: "Order",
        entityId: id,
        oldValues: { status: existingOrder.status },
        newValues: { status },
        userId: req.user?.id || "system",
        userRole: req.user?.role || "SYSTEM",
        reason: reason || "Status updated",
      },
    });

    res.json(order);
  } catch (error) {
    console.error("Failed to update order status", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

// PUT update order
router.put("/:id", async (req, res) => {
  try {
    const {
      customerId,
      items,
      paymentMethod,
      status,
      paymentReference,
      cashierId,
    } = req.body;

    const normalizedItems = items === undefined ? undefined : parseItems(items);

    if (
      items !== undefined &&
      (!normalizedItems || normalizedItems.length === 0)
    ) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    // Validate status if provided
    if (
      status !== undefined &&
      !Object.values(ORDER_STATUSES).includes(status)
    ) {
      return res.status(400).json({
        message: `Invalid status. Valid statuses: ${Object.values(
          ORDER_STATUSES
        ).join(", ")}`,
      });
    }

    // Validate payment method if provided
    let normalizedPaymentMethod;
    if (paymentMethod !== undefined) {
      const validPaymentMethods = [
        "cash",
        "upi",
        "card",
        "other",
        "wallet",
        "qr",
      ];
      normalizedPaymentMethod = validPaymentMethods.includes(
        paymentMethod.toLowerCase()
      )
        ? paymentMethod.toLowerCase()
        : "cash";
    }

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: req.params.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!existing) {
        return null;
      }

      let updateData = {};

      // Handle status update with validation
      if (status !== undefined) {
        if (!validateStatusTransition(existing.status, status)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }

        // Handle stock adjustments for status changes
        if (
          (existing.status === ORDER_STATUSES.CANCELLED ||
            existing.status === ORDER_STATUSES.REFUNDED) &&
          status !== ORDER_STATUSES.CANCELLED &&
          status !== ORDER_STATUSES.REFUNDED
        ) {
          // Restoring from cancelled/refunded - decrement stock
          for (const item of existing.items) {
            const oldStock = item.product.stock;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.qty,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "adjustment",
                quantity: item.qty,
                oldStock,
                newStock: oldStock - item.qty,
                reason: `Order ${existing.id} status changed from ${existing.status} to ${status}`,
              },
            });
          }
        } else if (
          (status === ORDER_STATUSES.CANCELLED ||
            status === ORDER_STATUSES.REFUNDED) &&
          existing.status !== ORDER_STATUSES.CANCELLED &&
          existing.status !== ORDER_STATUSES.REFUNDED
        ) {
          // Moving to cancelled/refunded - restore stock
          for (const item of existing.items) {
            const oldStock = item.product.stock;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.qty,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type:
                  status === ORDER_STATUSES.REFUNDED ? "refund" : "adjustment",
                quantity: item.qty,
                oldStock,
                newStock: oldStock + item.qty,
                reason: `Order ${existing.id} ${status}`,
              },
            });
          }
        }

        updateData.status = status;
      }

      if (customerId !== undefined) {
        // Check if customer exists when customerId is provided
        if (customerId) {
          const customerExists = await tx.customer.findUnique({
            where: { id: customerId },
          });

          if (!customerExists) {
            throw new Error("CUSTOMER_NOT_FOUND");
          }
        }
        updateData.customerId = customerId ?? null;
      }

      if (paymentMethod !== undefined) {
        updateData.paymentMethod = normalizedPaymentMethod;
      }

      if (paymentReference !== undefined) {
        updateData.paymentReference = paymentReference;
      }

      if (cashierId !== undefined) {
        if (cashierId) {
          const cashierExists = await tx.user.findUnique({
            where: { id: cashierId },
          });

          if (!cashierExists) {
            throw new Error("CASHIER_NOT_FOUND");
          }
        }
        updateData.cashierId = cashierId ?? null;
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

          if (stockChange > 0 && product && product.stock < stockChange) {
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

        // Update product stocks and create stock movements
        for (const item of normalizedItems) {
          const currentQty = currentProductQtys.get(item.productId) || 0;
          const stockChange = item.qty - currentQty;

          if (stockChange !== 0) {
            const product = products.find((p) => p.id === item.productId);
            const oldStock = product.stock;

            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: stockChange,
                },
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: stockChange > 0 ? "sale" : "adjustment",
                quantity: Math.abs(stockChange),
                oldStock,
                newStock: oldStock - stockChange,
                reason: `Order ${existing.id} item quantity update`,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Order",
        entityId: order.id,
        newValues: order,
        userId: req.user?.id || "system",
        userRole: req.user?.role || "SYSTEM",
      },
    });

    res.json(order);
  } catch (error) {
    if (error.message === "CUSTOMER_NOT_FOUND") {
      return res.status(400).json({ message: "Customer not found" });
    }

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

    if (error.message === "INVALID_STATUS_TRANSITION") {
      return res.status(400).json({
        message: "Invalid status transition",
      });
    }

    if (error.message === "CASHIER_NOT_FOUND") {
      return res.status(400).json({ message: "Cashier not found" });
    }

    console.error("Failed to update order", error);
    res.status(500).json({ message: "Failed to update order" });
  }
});

// DELETE order
router.delete("/:id", async (req, res) => {
  try {
    // First, check if order exists
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Restore product stock and delete order
    await prisma.$transaction(async (tx) => {
      // Restore product stock
      for (const item of order.items) {
        const oldStock = item.product.stock;
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.qty,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "adjustment",
            quantity: item.qty,
            oldStock,
            newStock: oldStock + item.qty,
            reason: `Order ${order.id} deleted`,
          },
        });
      }

      // Delete related records
      await tx.payment.deleteMany({
        where: { orderId: req.params.id },
      });

      await tx.refund.deleteMany({
        where: { orderId: req.params.id },
      });

      await tx.orderItem.deleteMany({
        where: { orderId: req.params.id },
      });

      // Now delete the order
      await tx.order.delete({
        where: { id: req.params.id },
      });
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Order",
        entityId: req.params.id,
        oldValues: order,
        userId: req.user?.id || "system",
        userRole: req.user?.role || "SYSTEM",
      },
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

// ==================== ORDER QUERY ENDPOINTS ====================

// GET orders by status
router.get("/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const { startDate, endDate, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Validate status
    if (!Object.values(ORDER_STATUSES).includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Valid statuses: ${Object.values(
          ORDER_STATUSES
        ).join(", ")}`,
      });
    }

    const where = { status };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderIncludes,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit) || 50,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
      summary: {
        status,
        count: total,
        totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
      },
    });
  } catch (error) {
    console.error("Failed to fetch orders by status", error);
    res.status(500).json({ message: "Failed to fetch orders by status" });
  }
});

// GET today's orders summary
router.get("/summary/today", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
      totalItems: orders.reduce(
        (sum, order) =>
          sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0),
        0
      ),
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
      topProducts: orders
        .flatMap((order) =>
          order.items.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            quantity: item.qty,
            revenue: item.qty * item.price,
          }))
        )
        .reduce((acc, item) => {
          if (!acc[item.productId]) {
            acc[item.productId] = { ...item };
          } else {
            acc[item.productId].quantity += item.quantity;
            acc[item.productId].revenue += item.revenue;
          }
          return acc;
        }, {}),
      hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        orders: 0,
        revenue: 0,
      })),
    };

    // Calculate hourly breakdown
    orders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      summary.hourlyBreakdown[hour].orders += 1;
      summary.hourlyBreakdown[hour].revenue += order.total;
    });

    // Convert top products to array and sort
    summary.topProducts = Object.values(summary.topProducts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json(summary);
  } catch (error) {
    console.error("Failed to fetch today's summary", error);
    res.status(500).json({ message: "Failed to fetch today's summary" });
  }
});

// GET orders summary by date range
router.get("/summary/range", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const summary = {
      dateRange: {
        start: startDate,
        end: endDate,
      },
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
      totalItems: orders.reduce(
        (sum, order) =>
          sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0),
        0
      ),
      completedOrders: orders.filter(
        (o) => o.status === ORDER_STATUSES.COMPLETED
      ).length,
      cancelledOrders: orders.filter(
        (o) => o.status === ORDER_STATUSES.CANCELLED
      ).length,
      refundedOrders: orders.filter((o) => o.status === ORDER_STATUSES.REFUNDED)
        .length,
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
      avgOrderValue:
        orders.length > 0
          ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length
          : 0,
      dailyBreakdown: {},
    };

    // Calculate daily breakdown
    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!summary.dailyBreakdown[date]) {
        summary.dailyBreakdown[date] = {
          date,
          orders: 0,
          revenue: 0,
          items: 0,
        };
      }
      summary.dailyBreakdown[date].orders += 1;
      summary.dailyBreakdown[date].revenue += order.total;
      summary.dailyBreakdown[date].items += order.items.reduce(
        (sum, item) => sum + item.qty,
        0
      );
    });

    // Convert to array
    summary.dailyBreakdown = Object.values(summary.dailyBreakdown).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    res.json(summary);
  } catch (error) {
    console.error("Failed to fetch range summary", error);
    res.status(500).json({ message: "Failed to fetch range summary" });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

// GET payment method statistics
router.get("/analytics/payment-methods", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        paymentMethod: true,
        total: true,
        customerId: true,
        status: true,
        createdAt: true,
      },
    });

    // Filter only completed orders
    const completedOrders = orders.filter(
      (order) => order.status === ORDER_STATUSES.COMPLETED
    );

    // Calculate payment method statistics
    const paymentStats = {
      cash: { count: 0, amount: 0, orders: [], refunds: 0 },
      upi: { count: 0, amount: 0, orders: [], refunds: 0 },
      card: { count: 0, amount: 0, orders: [], refunds: 0 },
      wallet: { count: 0, amount: 0, orders: [], refunds: 0 },
      qr: { count: 0, amount: 0, orders: [], refunds: 0 },
      other: { count: 0, amount: 0, orders: [], refunds: 0 },
    };

    // Calculate channel statistics
    const channelStats = {
      online: { count: 0, amount: 0, refunds: 0 },
      offline: { count: 0, amount: 0, refunds: 0 },
    };

    completedOrders.forEach((order) => {
      const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
      const channel = order.customerId ? "online" : "offline";

      // Update payment stats
      if (paymentStats[paymentMethod]) {
        paymentStats[paymentMethod].count += 1;
        paymentStats[paymentMethod].amount += order.total || 0;
        paymentStats[paymentMethod].orders.push(order);
      } else {
        paymentStats.other.count += 1;
        paymentStats.other.amount += order.total || 0;
        paymentStats.other.orders.push(order);
      }

      // Update channel stats
      channelStats[channel].count += 1;
      channelStats[channel].amount += order.total || 0;
    });

    // Calculate refund stats
    const refundedOrders = orders.filter(
      (order) => order.status === ORDER_STATUSES.REFUNDED
    );

    refundedOrders.forEach((order) => {
      const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
      const channel = order.customerId ? "online" : "offline";

      if (paymentStats[paymentMethod]) {
        paymentStats[paymentMethod].refunds += 1;
      }

      channelStats[channel].refunds += 1;
    });

    // Calculate percentages
    const totalOrders = completedOrders.length;
    const totalAmount = completedOrders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );

    const paymentSummary = Object.entries(paymentStats).map(
      ([method, stats]) => ({
        method,
        count: stats.count,
        amount: Math.round(stats.amount * 100) / 100,
        percentage:
          totalOrders > 0
            ? Math.round((stats.count / totalOrders) * 10000) / 100
            : 0,
        avgOrderValue:
          stats.count > 0
            ? Math.round((stats.amount / stats.count) * 100) / 100
            : 0,
        refunds: stats.refunds,
        refundRate:
          stats.count > 0
            ? Math.round((stats.refunds / stats.count) * 10000) / 100
            : 0,
      })
    );

    const channelSummary = Object.entries(channelStats).map(
      ([channel, stats]) => ({
        channel,
        count: stats.count,
        amount: Math.round(stats.amount * 100) / 100,
        percentage:
          totalOrders > 0
            ? Math.round((stats.count / totalOrders) * 10000) / 100
            : 0,
        avgOrderValue:
          stats.count > 0
            ? Math.round((stats.amount / stats.count) * 100) / 100
            : 0,
        refunds: stats.refunds,
        refundRate:
          stats.count > 0
            ? Math.round((stats.refunds / stats.count) * 10000) / 100
            : 0,
      })
    );

    // Get trends over time (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentOrders = orders.filter(
      (order) => new Date(order.createdAt) >= sevenDaysAgo
    );

    const dailyTrend = {};
    recentOrders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!dailyTrend[date]) {
        dailyTrend[date] = {
          cash: { count: 0, amount: 0 },
          upi: { count: 0, amount: 0 },
          card: { count: 0, amount: 0 },
          wallet: { count: 0, amount: 0 },
          qr: { count: 0, amount: 0 },
          other: { count: 0, amount: 0 },
          online: { count: 0, amount: 0 },
          offline: { count: 0, amount: 0 },
          total: 0,
        };
      }

      const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
      const channel = order.customerId ? "online" : "offline";
      const isRefund = order.status === ORDER_STATUSES.REFUNDED;

      if (dailyTrend[date][paymentMethod]) {
        dailyTrend[date][paymentMethod].count += isRefund ? -1 : 1;
        dailyTrend[date][paymentMethod].amount += isRefund
          ? -order.total
          : order.total;
      }

      dailyTrend[date][channel].count += isRefund ? -1 : 1;
      dailyTrend[date][channel].amount += isRefund ? -order.total : order.total;
      dailyTrend[date].total += isRefund ? -order.total : order.total;
    });

    res.json({
      summary: {
        totalOrders,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgOrderValue:
          totalOrders > 0
            ? Math.round((totalAmount / totalOrders) * 100) / 100
            : 0,
        totalRefunds: refundedOrders.length,
        refundRate:
          totalOrders > 0
            ? Math.round((refundedOrders.length / totalOrders) * 10000) / 100
            : 0,
        dateRange: {
          start: startDate || "all",
          end: endDate || "all",
        },
      },
      paymentMethods: paymentSummary.sort((a, b) => b.amount - a.amount),
      channels: channelSummary,
      dailyTrend: Object.entries(dailyTrend)
        .map(([date, stats]) => ({
          date,
          ...stats,
          paymentMethods: {
            cash: stats.cash.count,
            upi: stats.upi.count,
            card: stats.card.count,
            wallet: stats.wallet.count,
            qr: stats.qr.count,
            other: stats.other.count,
          },
          paymentAmounts: {
            cash: Math.round(stats.cash.amount * 100) / 100,
            upi: Math.round(stats.upi.amount * 100) / 100,
            card: Math.round(stats.card.amount * 100) / 100,
            wallet: Math.round(stats.wallet.amount * 100) / 100,
            qr: Math.round(stats.qr.amount * 100) / 100,
            other: Math.round(stats.other.amount * 100) / 100,
          },
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      insights: {
        topPaymentMethod:
          paymentSummary.sort((a, b) => b.amount - a.amount)[0]?.method ||
          "cash",
        dominantChannel:
          channelSummary.sort((a, b) => b.amount - a.amount)[0]?.channel ||
          "offline",
        cashDominance:
          paymentSummary.find((p) => p.method === "cash")?.percentage > 50,
        onlinePenetration:
          channelSummary.find((c) => c.channel === "online")?.percentage || 0,
        digitalPayments: paymentSummary
          .filter((p) => ["upi", "card", "wallet", "qr"].includes(p.method))
          .reduce((sum, p) => sum + p.percentage, 0),
        highestRefundRate: paymentSummary.sort(
          (a, b) => b.refundRate - a.refundRate
        )[0],
      },
    });
  } catch (error) {
    console.error("Failed to fetch payment analytics", error);
    res.status(500).json({ message: "Failed to fetch payment analytics" });
  }
});

// GET channel performance
router.get("/analytics/channels", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: { name: true },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                category: true,
                price: true,
                costPrice: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Separate orders by channel
    const onlineOrders = orders.filter((order) => order.customerId);
    const offlineOrders = orders.filter((order) => !order.customerId);

    // Calculate metrics for each channel
    const calculateMetrics = (channelOrders, channelName) => {
      const completedOrders = channelOrders.filter(
        (order) => order.status === ORDER_STATUSES.COMPLETED
      );
      const refundedOrders = channelOrders.filter(
        (order) => order.status === ORDER_STATUSES.REFUNDED
      );

      const totalAmount = completedOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );
      const refundAmount = Math.abs(
        refundedOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      );
      const netAmount = totalAmount - refundAmount;
      const orderCount = completedOrders.length;
      const refundCount = refundedOrders.length;

      // Time analysis
      const hourlyBreakdown = Array(24).fill(0);
      const weeklyBreakdown = Array(7).fill(0);

      completedOrders.forEach((order) => {
        const hour = new Date(order.createdAt).getHours();
        const day = new Date(order.createdAt).getDay();
        hourlyBreakdown[hour] += 1;
        weeklyBreakdown[day] += 1;
      });

      // Product analysis
      const productSales = {};
      let totalCost = 0;

      completedOrders.forEach((order) => {
        order.items.forEach((item) => {
          const productName = item.product?.name || "Unknown";
          const quantity = item.qty || 0;
          const revenue = (item.price || 0) * quantity;
          const cost = (item.product?.costPrice || item.price * 0.6) * quantity;

          totalCost += cost;

          if (!productSales[productName]) {
            productSales[productName] = {
              quantity: 0,
              revenue: 0,
              cost: 0,
            };
          }

          productSales[productName].quantity += quantity;
          productSales[productName].revenue += revenue;
          productSales[productName].cost += cost;
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          revenue: Math.round(data.revenue * 100) / 100,
          cost: Math.round(data.cost * 100) / 100,
          profit: Math.round((data.revenue - data.cost) * 100) / 100,
          margin:
            data.revenue > 0
              ? Math.round(
                  ((data.revenue - data.cost) / data.revenue) * 10000
                ) / 100
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Payment method analysis for this channel
      const paymentMethods = {};
      completedOrders.forEach((order) => {
        const method = order.paymentMethod?.toLowerCase() || "cash";
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });

      // Profit calculation
      const grossProfit = netAmount - totalCost;
      const profitMargin = netAmount > 0 ? (grossProfit / netAmount) * 100 : 0;

      return {
        channel: channelName,
        metrics: {
          totalOrders: orderCount,
          refundedOrders: refundCount,
          totalAmount: Math.round(totalAmount * 100) / 100,
          refundAmount: Math.round(refundAmount * 100) / 100,
          netAmount: Math.round(netAmount * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          avgOrderValue:
            orderCount > 0
              ? Math.round((netAmount / orderCount) * 100) / 100
              : 0,
          refundRate:
            orderCount > 0
              ? Math.round((refundCount / orderCount) * 10000) / 100
              : 0,
          peakHour: hourlyBreakdown.indexOf(Math.max(...hourlyBreakdown)),
          peakDay: [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ][weeklyBreakdown.indexOf(Math.max(...weeklyBreakdown))],
        },
        hourlyBreakdown: hourlyBreakdown.map((count, hour) => ({
          hour: `${hour.toString().padStart(2, "0")}:00`,
          orders: count,
        })),
        weeklyBreakdown: weeklyBreakdown.map((count, day) => ({
          day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day],
          orders: count,
        })),
        topProducts,
        paymentMethods: Object.entries(paymentMethods).map(
          ([method, count]) => ({
            method,
            count,
            percentage:
              orderCount > 0
                ? Math.round((count / orderCount) * 10000) / 100
                : 0,
          })
        ),
      };
    };

    const onlineMetrics = calculateMetrics(onlineOrders, "online");
    const offlineMetrics = calculateMetrics(offlineOrders, "offline");

    // Calculate comparison metrics
    const totalOrders = orders.filter(
      (order) => order.status === ORDER_STATUSES.COMPLETED
    ).length;
    const totalAmount = orders
      .filter((order) => order.status === ORDER_STATUSES.COMPLETED)
      .reduce((sum, order) => sum + (order.total || 0), 0);

    const comparison = {
      orderShare: {
        online:
          Math.round(
            (onlineMetrics.metrics.totalOrders / totalOrders) * 10000
          ) / 100,
        offline:
          Math.round(
            (offlineMetrics.metrics.totalOrders / totalOrders) * 10000
          ) / 100,
      },
      revenueShare: {
        online:
          Math.round((onlineMetrics.metrics.netAmount / totalAmount) * 10000) /
          100,
        offline:
          Math.round((offlineMetrics.metrics.netAmount / totalAmount) * 10000) /
          100,
      },
      avgOrderValueComparison: {
        online: onlineMetrics.metrics.avgOrderValue,
        offline: offlineMetrics.metrics.avgOrderValue,
        difference:
          Math.round(
            (onlineMetrics.metrics.avgOrderValue -
              offlineMetrics.metrics.avgOrderValue) *
              100
          ) / 100,
      },
      profitComparison: {
        online: onlineMetrics.metrics.profitMargin,
        offline: offlineMetrics.metrics.profitMargin,
        difference:
          Math.round(
            (onlineMetrics.metrics.profitMargin -
              offlineMetrics.metrics.profitMargin) *
              100
          ) / 100,
      },
      refundRateComparison: {
        online: onlineMetrics.metrics.refundRate,
        offline: offlineMetrics.metrics.refundRate,
        difference:
          Math.round(
            (onlineMetrics.metrics.refundRate -
              offlineMetrics.metrics.refundRate) *
              100
          ) / 100,
      },
    };

    res.json({
      summary: {
        totalOrders,
        totalAmount: Math.round(totalAmount * 100) / 100,
        dateRange: {
          start: startDate || "all",
          end: endDate || "all",
        },
      },
      channels: {
        online: onlineMetrics,
        offline: offlineMetrics,
      },
      comparison,
      recommendations: generateRecommendations(
        onlineMetrics,
        offlineMetrics,
        comparison
      ),
    });
  } catch (error) {
    console.error("Failed to fetch channel analytics", error);
    res.status(500).json({ message: "Failed to fetch channel analytics" });
  }
});

// Helper function to generate channel recommendations
function generateRecommendations(online, offline, comparison) {
  const recommendations = [];

  // Revenue share recommendations
  if (comparison.revenueShare.online < 30) {
    recommendations.push({
      type: "revenue_growth",
      channel: "online",
      suggestion:
        "Increase online presence through digital marketing and promotions",
      priority: "high",
      expectedImpact: "Increase online revenue share by 15-20%",
      timeline: "30 days",
    });
  }

  if (comparison.revenueShare.offline < 30) {
    recommendations.push({
      type: "revenue_growth",
      channel: "offline",
      suggestion: "Enhance in-store experience and implement loyalty programs",
      priority: "high",
      expectedImpact: "Increase offline revenue share by 10-15%",
      timeline: "30 days",
    });
  }

  // Average order value recommendations
  if (comparison.avgOrderValueComparison.difference > 20) {
    recommendations.push({
      type: "value_optimization",
      channel: "offline",
      suggestion: `Introduce bundle deals to increase offline average order value (currently ₹${offline.metrics.avgOrderValue})`,
      priority: "medium",
      expectedImpact: "Increase offline AOV by 10-15%",
      timeline: "14 days",
    });
  } else if (comparison.avgOrderValueComparison.difference < -20) {
    recommendations.push({
      type: "value_optimization",
      channel: "online",
      suggestion: `Add premium products or minimum order discounts to increase online average order value (currently ₹${online.metrics.avgOrderValue})`,
      priority: "medium",
      expectedImpact: "Increase online AOV by 10-15%",
      timeline: "14 days",
    });
  }

  // Profit margin recommendations
  if (comparison.profitComparison.difference > 10) {
    recommendations.push({
      type: "profit_optimization",
      channel: "online",
      suggestion:
        "Optimize online pricing strategy and reduce operational costs",
      priority: "medium",
      expectedImpact: "Improve online profit margin by 5-8%",
      timeline: "45 days",
    });
  } else if (comparison.profitComparison.difference < -10) {
    recommendations.push({
      type: "profit_optimization",
      channel: "offline",
      suggestion:
        "Reduce overhead costs and optimize inventory for offline sales",
      priority: "medium",
      expectedImpact: "Improve offline profit margin by 5-8%",
      timeline: "45 days",
    });
  }

  // Refund rate recommendations
  if (comparison.refundRateComparison.difference > 5) {
    recommendations.push({
      type: "quality_improvement",
      channel: "online",
      suggestion: "Improve product descriptions, images, and quality control",
      priority: "high",
      expectedImpact: "Reduce online refund rate by 30-40%",
      timeline: "30 days",
    });
  } else if (comparison.refundRateComparison.difference < -5) {
    recommendations.push({
      type: "quality_improvement",
      channel: "offline",
      suggestion: "Enhance staff training and customer service",
      priority: "high",
      expectedImpact: "Reduce offline refund rate by 30-40%",
      timeline: "30 days",
    });
  }

  // Time-based recommendations
  if (online.metrics.peakHour !== offline.metrics.peakHour) {
    recommendations.push({
      type: "timing_optimization",
      channels: "both",
      suggestion: `Align promotions: Online peaks at ${online.metrics.peakHour}:00, Offline at ${offline.metrics.peakHour}:00`,
      priority: "low",
      expectedImpact: "Increase cross-channel sales by 8-12%",
      timeline: "7 days",
    });
  }

  // Product-based recommendations
  const onlineTop = online.topProducts[0]?.name;
  const offlineTop = offline.topProducts[0]?.name;

  if (onlineTop && offlineTop && onlineTop !== offlineTop) {
    recommendations.push({
      type: "product_cross_promotion",
      channels: "both",
      suggestion: `Cross-promote top products: Feature "${onlineTop}" offline and "${offlineTop}" online`,
      priority: "medium",
      expectedImpact: "Increase product visibility and sales by 15-20%",
      timeline: "14 days",
    });
  }

  return recommendations;
}

export default router;
