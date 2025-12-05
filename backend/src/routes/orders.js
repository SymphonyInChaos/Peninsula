// routes/orders.js
import { Router } from "express";
import prisma, { validateOrder } from "../utils/db.js";
import { generateNextId } from "../utils/idGenerator.js";

const router = Router();

// CORRECTED: Changed 'customers' to 'customer'
const orderIncludes = {
  customer: true, // SINGULAR - matches your Prisma schema
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
    const { customerId = null, items, paymentMethod = "cash" } = req.body;

    const normalizedItems = parseItems(items);

    if (!normalizedItems || normalizedItems.length === 0) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    // Validate payment method
    const validPaymentMethods = ["cash", "upi", "card", "other"];
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
          paymentMethod: validatedData.paymentMethod,
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
    const { customerId, items, paymentMethod } = req.body;

    const normalizedItems = items === undefined ? undefined : parseItems(items);

    if (
      items !== undefined &&
      (!normalizedItems || normalizedItems.length === 0)
    ) {
      return res.status(400).json({ message: "Order items are invalid" });
    }

    // Validate payment method if provided
    let normalizedPaymentMethod;
    if (paymentMethod !== undefined) {
      const validPaymentMethods = ["cash", "upi", "card", "other"];
      normalizedPaymentMethod = validPaymentMethods.includes(
        paymentMethod.toLowerCase()
      )
        ? paymentMethod.toLowerCase()
        : "cash";
    }

    // Validate order structure if items are provided
    if (normalizedItems) {
      try {
        validateOrder({
          customerId: customerId !== undefined ? customerId : null,
          items: normalizedItems,
          paymentMethod: normalizedPaymentMethod || "cash",
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

// New endpoint: Get payment method statistics
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
        paymentMethod: true,
        total: true,
        customerId: true,
        createdAt: true,
      },
    });

    // Calculate payment method statistics
    const paymentStats = {
      cash: { count: 0, amount: 0, orders: [] },
      upi: { count: 0, amount: 0, orders: [] },
      card: { count: 0, amount: 0, orders: [] },
      other: { count: 0, amount: 0, orders: [] },
    };

    // Calculate channel statistics
    const channelStats = {
      online: { count: 0, amount: 0 },
      offline: { count: 0, amount: 0 },
    };

    orders.forEach((order) => {
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

    // Calculate percentages
    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
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
        recentOrders: stats.orders.slice(-5).map((order) => ({
          id: order.id,
          amount: order.total,
          date: order.createdAt,
        })),
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
          cash: 0,
          upi: 0,
          card: 0,
          other: 0,
          online: 0,
          offline: 0,
        };
      }

      const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
      const channel = order.customerId ? "online" : "offline";

      if (dailyTrend[date][paymentMethod] !== undefined) {
        dailyTrend[date][paymentMethod] += 1;
      } else {
        dailyTrend[date].other += 1;
      }

      dailyTrend[date][channel] += 1;
    });

    res.json({
      summary: {
        totalOrders,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgOrderValue:
          totalOrders > 0
            ? Math.round((totalAmount / totalOrders) * 100) / 100
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
      },
    });
  } catch (error) {
    console.error("Failed to fetch payment analytics", error);
    res.status(500).json({ message: "Failed to fetch payment analytics" });
  }
});

// New endpoint: Get channel performance
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
              select: { name: true, category: true },
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
      const totalAmount = channelOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );
      const orderCount = channelOrders.length;

      // Time analysis
      const hourlyBreakdown = Array(24).fill(0);
      const weeklyBreakdown = Array(7).fill(0);

      channelOrders.forEach((order) => {
        const hour = new Date(order.createdAt).getHours();
        const day = new Date(order.createdAt).getDay();
        hourlyBreakdown[hour] += 1;
        weeklyBreakdown[day] += 1;
      });

      // Product analysis
      const productSales = {};
      channelOrders.forEach((order) => {
        order.items.forEach((item) => {
          const productName = item.product?.name || "Unknown";
          productSales[productName] =
            (productSales[productName] || 0) + (item.qty || 0);
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Payment method analysis for this channel
      const paymentMethods = {};
      channelOrders.forEach((order) => {
        const method = order.paymentMethod?.toLowerCase() || "cash";
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });

      return {
        channel: channelName,
        metrics: {
          totalOrders: orderCount,
          totalAmount: Math.round(totalAmount * 100) / 100,
          avgOrderValue:
            orderCount > 0
              ? Math.round((totalAmount / orderCount) * 100) / 100
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
        hourlyBreakdown,
        weeklyBreakdown,
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
    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );

    const comparison = {
      orderShare: {
        online: Math.round((onlineOrders.length / totalOrders) * 10000) / 100,
        offline: Math.round((offlineOrders.length / totalOrders) * 10000) / 100,
      },
      revenueShare: {
        online:
          Math.round(
            (onlineMetrics.metrics.totalAmount / totalAmount) * 10000
          ) / 100,
        offline:
          Math.round(
            (offlineMetrics.metrics.totalAmount / totalAmount) * 10000
          ) / 100,
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
    });
  }

  if (comparison.revenueShare.offline < 30) {
    recommendations.push({
      type: "revenue_growth",
      channel: "offline",
      suggestion: "Enhance in-store experience and implement loyalty programs",
      priority: "high",
    });
  }

  // Average order value recommendations
  if (comparison.avgOrderValueComparison.difference > 20) {
    recommendations.push({
      type: "value_optimization",
      channel: "offline",
      suggestion: `Introduce bundle deals to increase offline average order value (currently ₹${offline.metrics.avgOrderValue})`,
      priority: "medium",
    });
  } else if (comparison.avgOrderValueComparison.difference < -20) {
    recommendations.push({
      type: "value_optimization",
      channel: "online",
      suggestion: `Add premium products or minimum order discounts to increase online average order value (currently ₹${online.metrics.avgOrderValue})`,
      priority: "medium",
    });
  }

  // Time-based recommendations
  if (online.metrics.peakHour !== offline.metrics.peakHour) {
    recommendations.push({
      type: "timing_optimization",
      channels: "both",
      suggestion: `Align promotions: Online peaks at ${online.metrics.peakHour}:00, Offline at ${offline.metrics.peakHour}:00`,
      priority: "low",
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
    });
  }

  return recommendations;
}

export default router;
