// services/reportService.js
import prisma from "../utils/db.js";
import { AppError } from "../middleware/errorHandler.js";

export class ReportService {
  // Constants
  static VALID_PAYMENT_METHODS = [
    "cash",
    "upi",
    "card",
    "qr",
    "wallet",
    "other",
  ];
  static VALID_CHANNELS = ["online", "offline"];
  static VALID_ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "completed",
    "cancelled",
    "refunded",
  ];
  static COMPLETED_STATUSES = ["completed", "processing", "pending", "confirmed"];
  static EXCLUDED_STATUSES = ["cancelled"];
  static ORDER_STATUS_FLOW = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["completed", "cancelled"],
    completed: ["refunded"],
    cancelled: [],
    refunded: [],
  };

  // Utility: Validate and normalize date range
  static normalizeDateRange(startDate, endDate, defaultDays = 30) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();

    // Ensure start <= end
    if (start > end) {
      [start, end] = [end, start];
    }

    // Set to start/end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // Utility: Convert to UTC for database queries
  static toUTC(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  }

  // Utility: Validate order for inclusion in reports
  static isValidOrder(order) {
    // Must have items
    if (!order.items || order.items.length === 0) return false;

    // Must have positive total
    if (!order.total || order.total <= 0) return false;

    // Must be in valid status
    if (!this.VALID_ORDER_STATUSES.includes(order.status)) return false;

    // Check all items have valid product references
    const allItemsValid = order.items.every(
      (item) => item.productId || (item.productName && item.price && item.qty)
    );

    return allItemsValid;
  }

  // Utility: Calculate payment breakdown
  static calculatePaymentBreakdown(orders) {
    const validOrders = orders.filter(
      (order) =>
        this.isValidOrder(order) &&
        !this.EXCLUDED_STATUSES.includes(order.status)
    );

    const breakdown = {
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      qr: { count: 0, amount: 0 },
      wallet: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
    };

    validOrders.forEach((order) => {
      const method = order.paymentMethod?.toLowerCase() || "cash";
      const validMethod = this.VALID_PAYMENT_METHODS.includes(method)
        ? method
        : "other";

      breakdown[validMethod].count += 1;

      // Handle refunds: refunded orders reduce amount
      if (order.status === "refunded") {
        breakdown[validMethod].amount -= Math.abs(order.total || 0);
      } else {
        breakdown[validMethod].amount += Math.abs(order.total || 0);
      }
    });

    const totalOrders = validOrders.length;
    const totalAmount = Object.values(breakdown).reduce(
      (sum, data) => sum + data.amount,
      0
    );

    return Object.entries(breakdown).map(([method, data]) => ({
      method,
      count: data.count,
      amount: Math.max(0, Math.round(data.amount * 100) / 100), // Never negative
      percentage:
        totalOrders > 0
          ? Math.round((data.count / totalOrders) * 10000) / 100
          : 0,
      amountPercentage:
        totalAmount > 0
          ? Math.round((data.amount / totalAmount) * 10000) / 100
          : 0,
    }));
  }

  // Utility: Calculate channel breakdown
  static calculateChannelBreakdown(orders) {
    const validOrders = orders.filter(
      (order) =>
        this.isValidOrder(order) &&
        !this.EXCLUDED_STATUSES.includes(order.status)
    );

    const channelData = {
      online: { count: 0, amount: 0, withPaymentRef: 0, withCashier: 0 },
      offline: { count: 0, amount: 0, withPaymentRef: 0, withCashier: 0 },
    };

    validOrders.forEach((order) => {
      const channel = order.customerId ? "online" : "offline";

      channelData[channel].count += 1;

      // Handle refunds
      if (order.status === "refunded") {
        channelData[channel].amount -= Math.abs(order.total || 0);
      } else {
        channelData[channel].amount += Math.abs(order.total || 0);
      }

      // Track validation rules
      if (channel === "online" && order.paymentReference) {
        channelData[channel].withPaymentRef += 1;
      }
      if (channel === "offline" && order.cashierId) {
        channelData[channel].withCashier += 1;
      }
    });

    const totalOrders = validOrders.length;
    const totalAmount = Object.values(channelData).reduce(
      (sum, data) => sum + data.amount,
      0
    );

    return Object.entries(channelData).map(([channel, data]) => ({
      channel,
      count: data.count,
      amount: Math.max(0, Math.round(data.amount * 100) / 100),
      percentage:
        totalOrders > 0
          ? Math.round((data.count / totalOrders) * 10000) / 100
          : 0,
      avgOrderValue:
        data.count > 0 ? Math.round((data.amount / data.count) * 100) / 100 : 0,
      validationScore:
        channel === "online"
          ? (data.withPaymentRef / data.count) * 100 || 0
          : (data.withCashier / data.count) * 100 || 0,
    }));
  }

  // DAILY SALES REPORT - Enhanced with all edge cases
  static async getDailySalesReport(date = null) {
    try {
      const { start, end } = this.normalizeDateRange(
        date,
        date || new Date(),
        1
      );
      const startUTC = this.toUTC(start);
      const endUTC = this.toUTC(end);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startUTC, lte: endUTC },
          status: { notIn: this.EXCLUDED_STATUSES },
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  sku: true,
                  category: true, // This is scalar field
                },
              },
            },
          },
          // REMOVED: cashier relation doesn't exist
        },
        orderBy: { createdAt: "desc" },
      });

      // Add null cashier to orders since relation doesn't exist
      const ordersWithCashier = orders.map((order) => ({
        ...order,
        cashier: null,
        cashierId: null,
      }));

      // Filter out any remaining invalid orders
      const validOrders = ordersWithCashier.filter((order) =>
        this.isValidOrder(order)
      );

      // Calculate metrics
      const completedOrders = validOrders.filter((order) =>
        this.COMPLETED_STATUSES.includes(order.status)
      );

      const refundedOrders = validOrders.filter(
        (order) => order.status === "refunded"
      );

      const totalSales = completedOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );

      const totalRefunds = Math.abs(
        refundedOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      );

      const netRevenue = totalSales - totalRefunds;
      const orderCount = completedOrders.length;
      const avgOrderValue = orderCount > 0 ? netRevenue / orderCount : 0;

      // Product sales with validation
      const productSales = {};
      const productStockValidation = {};
      const productSnapshots = {};

      completedOrders.forEach((order) => {
        order.items.forEach((item) => {
          const productId = item.productId || "unknown";
          const productName =
            item.product?.name || item.productName || "Unknown Product";
          const productSku = item.product?.sku || "N/A";
          const quantity = Math.max(0, item.qty || 0);
          const price = Math.max(0, item.price || 0);

          // Store product snapshot for historical accuracy
          if (!productSnapshots[productId]) {
            productSnapshots[productId] = {
              id: productId,
              name: productName,
              sku: productSku,
              price: price,
            };
          }

          if (productSales[productId]) {
            productSales[productId].quantity += quantity;
            productSales[productId].revenue += quantity * price;
          } else {
            productSales[productId] = {
              name: productName,
              sku: productSku,
              quantity: quantity,
              revenue: quantity * price,
              price: price,
            };
          }

          // Track for stock validation
          if (!productStockValidation[productId]) {
            productStockValidation[productId] = 0;
          }
          productStockValidation[productId] += quantity;
        });
      });

      // Get current stock for validation
      const productIds = Object.keys(productSales);
      if (productIds.length > 0) {
        const currentProducts = await prisma.product.findMany({
          where: { id: { in: productIds.filter((id) => id !== "unknown") } },
          select: { id: true, stock: true, name: true },
        });

        currentProducts.forEach((product) => {
          if (productStockValidation[product.id]) {
            const sold = productStockValidation[product.id];
            const currentStock = product.stock || 0;
            const stockIssue = sold > currentStock + sold; // Should never happen
            if (stockIssue) {
              console.warn(
                `Stock validation issue for ${product.name}: Sold ${sold}, Current ${currentStock}`
              );
            }
          }
        });
      }

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((p) => ({
          id: p.id || "unknown",
          name: p.name,
          sku: p.sku,
          quantity: p.quantity,
          revenue: Math.round(p.revenue * 100) / 100,
          price: p.price,
        }));

      const hourlyBreakdown = await this.getHourlySales(startUTC, endUTC);
      const paymentBreakdown = this.calculatePaymentBreakdown(validOrders);
      const channelBreakdown = this.calculateChannelBreakdown(validOrders);

      // Validation warnings
      const warnings = [];
      const onlineOrders = validOrders.filter((o) => o.customerId);
      const offlineOrders = validOrders.filter((o) => !o.customerId);

      const onlineWithoutPaymentRef = onlineOrders.filter(
        (o) => !o.paymentReference
      ).length;
      const offlineWithoutCashier = offlineOrders.filter(
        (o) => !o.cashierId
      ).length;

      if (onlineWithoutPaymentRef > 0) {
        warnings.push({
          type: "validation",
          message: `${onlineWithoutPaymentRef} online orders missing payment reference`,
          severity: "medium",
        });
      }

      if (offlineWithoutCashier > 0) {
        warnings.push({
          type: "validation",
          message: `${offlineWithoutCashier} offline orders missing cashier assignment`,
          severity: "low",
        });
      }

      const invalidOrders = orders.length - validOrders.length;
      if (invalidOrders > 0) {
        warnings.push({
          type: "data_quality",
          message: `${invalidOrders} orders excluded due to data issues`,
          severity: "high",
        });
      }

      return {
        date: start.toISOString().split("T")[0],
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
          timezone: "UTC",
        },
        summary: {
          totalOrders: validOrders.length,
          completedOrders: completedOrders.length,
          refundedOrders: refundedOrders.length,
          cancelledOrders: orders.filter((o) => o.status === "cancelled")
            .length,
          grossRevenue: Math.round(totalSales * 100) / 100,
          totalRefunds: Math.round(totalRefunds * 100) / 100,
          netRevenue: Math.round(netRevenue * 100) / 100,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          totalItems: completedOrders.reduce(
            (sum, order) =>
              sum +
              order.items.reduce(
                (itemSum, item) => itemSum + (item.qty || 0),
                0
              ),
            0
          ),
        },
        paymentInsights: {
          split: paymentBreakdown,
          topMethod:
            paymentBreakdown.sort((a, b) => b.amount - a.amount)[0]?.method ||
            "cash",
          cashPercentage:
            paymentBreakdown.find((p) => p.method === "cash")?.percentage || 0,
          hasSplitPayments: validOrders.some(
            (o) => o.paymentSplit && o.paymentSplit.length > 1
          ),
          validation: {
            totalValid: paymentBreakdown.reduce((sum, p) => sum + p.count, 0),
            hasMissingMethods: validOrders.some((o) => !o.paymentMethod),
          },
        },
        channelInsights: {
          split: channelBreakdown,
          dominantChannel:
            channelBreakdown.sort((a, b) => b.amount - a.amount)[0]?.channel ||
            "offline",
          onlinePercentage:
            channelBreakdown.find((c) => c.channel === "online")?.percentage ||
            0,
          validationScores: {
            online:
              channelBreakdown.find((c) => c.channel === "online")
                ?.validationScore || 0,
            offline:
              channelBreakdown.find((c) => c.channel === "offline")
                ?.validationScore || 0,
          },
        },
        productInsights: {
          topProducts,
          totalUniqueProducts: Object.keys(productSales).length,
          productSnapshots: Object.values(productSnapshots),
          stockValidation: Object.entries(productStockValidation).map(
            ([id, sold]) => ({
              productId: id,
              productName: productSales[id]?.name || "Unknown",
              quantitySold: sold,
              hasStockIssues: false, // Would be set by stock validation logic
            })
          ),
        },
        hourlyBreakdown,
        orderBreakdown: {
          byStatus: this.VALID_ORDER_STATUSES.reduce((acc, status) => {
            acc[status] = validOrders.filter((o) => o.status === status).length;
            return acc;
          }, {}),
          byHour: hourlyBreakdown.reduce((acc, hour) => {
            acc[hour.hour] = hour.orders;
            return acc;
          }, {}),
        },
        warnings,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataPoints: {
            totalOrdersFetched: orders.length,
            validOrders: validOrders.length,
            invalidOrdersExcluded: invalidOrders,
            productCount: Object.keys(productSales).length,
          },
          validation: {
            hasNegativeValues: netRevenue < 0,
            hasZeroQuantityItems: validOrders.some((o) =>
              o.items.some((i) => !i.qty || i.qty <= 0)
            ),
            hasMissingProductRefs: validOrders.some((o) =>
              o.items.some((i) => !i.productId && !i.productName)
            ),
          },
        },
      };
    } catch (error) {
      console.error("❌ Daily sales report error:", error);

      // Return safe empty structure
      return this.getEmptyReportStructure("daily", error.message);
    }
  }

  // HOURLY SALES BREAKDOWN - Enhanced
  static async getHourlySales(startDate, endDate) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: { notIn: this.EXCLUDED_STATUSES },
        },
        select: {
          createdAt: true,
          total: true,
          paymentMethod: true,
          customerId: true,
          cashierId: true,
          status: true,
        },
      });

      const hourlyData = {};
      for (let hour = 0; hour < 24; hour++) {
        hourlyData[hour] = {
          sales: 0,
          orders: 0,
          refunds: 0,
          paymentMethods: {
            cash: 0,
            upi: 0,
            card: 0,
            qr: 0,
            wallet: 0,
            other: 0,
          },
          channels: { online: 0, offline: 0 },
        };
      }

      orders.forEach((order) => {
        if (!this.isValidOrder(order)) return;

        const hour = new Date(order.createdAt).getHours();
        const isRefund = order.status === "refunded";
        const amount = Math.abs(order.total || 0);

        if (isRefund) {
          hourlyData[hour].refunds += amount;
          hourlyData[hour].sales -= amount;
        } else {
          hourlyData[hour].sales += amount;
          hourlyData[hour].orders += 1;
        }

        // Payment method
        const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
        const validMethod = this.VALID_PAYMENT_METHODS.includes(paymentMethod)
          ? paymentMethod
          : "other";
        hourlyData[hour].paymentMethods[validMethod] += isRefund ? -1 : 1;

        // Channel
        const channel = order.customerId ? "online" : "offline";
        hourlyData[hour].channels[channel] += isRefund ? -1 : 1;
      });

      return Object.entries(hourlyData).map(([hour, data]) => {
        const totalOrders = Math.max(0, data.orders);
        const paymentEntries = Object.entries(data.paymentMethods);
        const dominantPayment =
          paymentEntries.sort(
            (a, b) => Math.abs(b[1]) - Math.abs(a[1])
          )[0]?.[0] || "cash";

        const onlineOrders = Math.max(0, data.channels.online);
        const offlineOrders = Math.max(0, data.channels.offline);
        const totalChannelOrders = onlineOrders + offlineOrders;
        const onlinePercentage =
          totalChannelOrders > 0
            ? Math.round((onlineOrders / totalChannelOrders) * 10000) / 100
            : 0;

        return {
          hour: `${hour.toString().padStart(2, "0")}:00`,
          sales: Math.max(0, Math.round(data.sales * 100) / 100),
          orders: totalOrders,
          refunds: Math.max(0, Math.round(data.refunds * 100) / 100),
          netSales: Math.max(
            0,
            Math.round((data.sales - data.refunds) * 100) / 100
          ),
          dominantPaymentMethod: dominantPayment,
          onlinePercentage: onlinePercentage,
          paymentSplit: data.paymentMethods,
          channelSplit: data.channels,
        };
      });
    } catch (error) {
      console.error("❌ Hourly sales error:", error);
      return Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        sales: 0,
        orders: 0,
        refunds: 0,
        netSales: 0,
        dominantPaymentMethod: "cash",
        onlinePercentage: 0,
        paymentSplit: { cash: 0, upi: 0, card: 0, qr: 0, wallet: 0, other: 0 },
        channelSplit: { online: 0, offline: 0 },
      }));
    }
  }

  // PAYMENT ANALYTICS REPORT - Complete with edge cases
  static async getPaymentAnalyticsReport(startDate = null, endDate = null) {
    try {
      const { start, end } = this.normalizeDateRange(startDate, endDate, 30);
      const startUTC = this.toUTC(start);
      const endUTC = this.toUTC(end);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startUTC, lte: endUTC },
          AND: [{ items: { some: {} } }, { total: { gt: 0 } }],
        },
        include: {
          customer: { select: { id: true } },
          items: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by date
      const dailyData = {};
      const dates = [];
      let currentDate = new Date(start);

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split("T")[0];
        dates.push(dateStr);
        dailyData[dateStr] = {
          date: dateStr,
          total: 0,
          orders: 0,
          refunds: 0,
          paymentMethods: this.VALID_PAYMENT_METHODS.reduce((acc, method) => {
            acc[method] = { count: 0, amount: 0 };
            return acc;
          }, {}),
          channels: {
            online: { count: 0, amount: 0 },
            offline: { count: 0, amount: 0 },
          },
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Process orders
      orders.forEach((order) => {
        if (!this.isValidOrder(order)) return;

        const dateStr = order.createdAt.toISOString().split("T")[0];
        if (!dailyData[dateStr]) return;

        const isRefund = order.status === "refunded";
        const amount = Math.abs(order.total || 0);
        const paymentMethod = order.paymentMethod?.toLowerCase() || "cash";
        const validMethod = this.VALID_PAYMENT_METHODS.includes(paymentMethod)
          ? paymentMethod
          : "other";
        const channel = order.customerId ? "online" : "offline";

        if (isRefund) {
          dailyData[dateStr].refunds += amount;
          dailyData[dateStr].total -= amount;
          dailyData[dateStr].paymentMethods[validMethod].amount -= amount;
          dailyData[dateStr].paymentMethods[validMethod].count -= 1;
          dailyData[dateStr].channels[channel].amount -= amount;
          dailyData[dateStr].channels[channel].count -= 1;
        } else {
          dailyData[dateStr].total += amount;
          dailyData[dateStr].orders += 1;
          dailyData[dateStr].paymentMethods[validMethod].amount += amount;
          dailyData[dateStr].paymentMethods[validMethod].count += 1;
          dailyData[dateStr].channels[channel].amount += amount;
          dailyData[dateStr].channels[channel].count += 1;
        }
      });

      // Build daily trend
      const dailyTrend = dates.map((dateStr) => {
        const day = dailyData[dateStr];
        const paymentSplit = this.VALID_PAYMENT_METHODS.map((method) => ({
          method,
          count: Math.max(0, day.paymentMethods[method].count),
          amount: Math.max(0, day.paymentMethods[method].amount),
          percentage:
            day.orders > 0
              ? Math.round(
                  (Math.max(0, day.paymentMethods[method].count) / day.orders) *
                    10000
                ) / 100
              : 0,
        })).filter((p) => p.count > 0);

        const channelSplit = ["online", "offline"].map((channel) => ({
          channel,
          count: Math.max(0, day.channels[channel].count),
          amount: Math.max(0, day.channels[channel].amount),
          percentage:
            day.orders > 0
              ? Math.round(
                  (Math.max(0, day.channels[channel].count) / day.orders) *
                    10000
                ) / 100
              : 0,
        }));

        const dominantPayment =
          paymentSplit.sort((a, b) => b.count - a.count)[0]?.method || "cash";
        const dominantChannel =
          channelSplit.sort((a, b) => b.count - a.count)[0]?.channel ||
          "offline";

        return {
          ...day,
          netTotal: Math.max(0, day.total),
          paymentSplit,
          channelSplit,
          dominantPayment,
          dominantChannel,
          avgOrderValue:
            day.orders > 0
              ? Math.round((Math.max(0, day.total) / day.orders) * 100) / 100
              : 0,
        };
      });

      // Overall summary
      const validOrders = orders.filter(
        (order) =>
          this.isValidOrder(order) &&
          !this.EXCLUDED_STATUSES.includes(order.status)
      );

      const refundedOrders = orders.filter(
        (order) => order.status === "refunded"
      );

      const totalOrders = validOrders.length;
      const totalRefunded = refundedOrders.length;
      const grossRevenue = validOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );
      const totalRefunds = Math.abs(
        refundedOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      );
      const netRevenue = Math.max(0, grossRevenue - totalRefunds);

      // Payment summary
      const paymentSummary = this.VALID_PAYMENT_METHODS.reduce(
        (acc, method) => {
          const methodOrders = validOrders.filter(
            (order) => (order.paymentMethod?.toLowerCase() || "cash") === method
          );
          const methodRefunds = refundedOrders.filter(
            (order) => (order.paymentMethod?.toLowerCase() || "cash") === method
          );

          const methodRevenue = methodOrders.reduce(
            (sum, order) => sum + (order.total || 0),
            0
          );
          const methodRefundAmount = Math.abs(
            methodRefunds.reduce((sum, order) => sum + (order.total || 0), 0)
          );
          const methodNetRevenue = Math.max(
            0,
            methodRevenue - methodRefundAmount
          );

          acc[method] = {
            orders: methodOrders.length,
            refunds: methodRefunds.length,
            grossRevenue: Math.round(methodRevenue * 100) / 100,
            refundAmount: Math.round(methodRefundAmount * 100) / 100,
            netRevenue: Math.round(methodNetRevenue * 100) / 100,
            percentage:
              totalOrders > 0
                ? Math.round((methodOrders.length / totalOrders) * 10000) / 100
                : 0,
            avgOrderValue:
              methodOrders.length > 0
                ? Math.round((methodNetRevenue / methodOrders.length) * 100) /
                  100
                : 0,
            refundRate:
              methodOrders.length > 0
                ? Math.round(
                    (methodRefunds.length / methodOrders.length) * 10000
                  ) / 100
                : 0,
          };
          return acc;
        },
        {}
      );

      // Channel summary
      const channelSummary = {
        online: {
          orders: validOrders.filter((order) => order.customerId).length,
          refunds: refundedOrders.filter((order) => order.customerId).length,
          grossRevenue: validOrders
            .filter((order) => order.customerId)
            .reduce((sum, order) => sum + (order.total || 0), 0),
          refundAmount: Math.abs(
            refundedOrders
              .filter((order) => order.customerId)
              .reduce((sum, order) => sum + (order.total || 0), 0)
          ),
        },
        offline: {
          orders: validOrders.filter((order) => !order.customerId).length,
          refunds: refundedOrders.filter((order) => !order.customerId).length,
          grossRevenue: validOrders
            .filter((order) => !order.customerId)
            .reduce((sum, order) => sum + (order.total || 0), 0),
          refundAmount: Math.abs(
            refundedOrders
              .filter((order) => !order.customerId)
              .reduce((sum, order) => sum + (order.total || 0), 0)
          ),
        },
      };

      ["online", "offline"].forEach((channel) => {
        const data = channelSummary[channel];
        data.netRevenue = Math.max(0, data.grossRevenue - data.refundAmount);
        data.percentage =
          totalOrders > 0
            ? Math.round((data.orders / totalOrders) * 10000) / 100
            : 0;
        data.avgOrderValue =
          data.orders > 0
            ? Math.round((data.netRevenue / data.orders) * 100) / 100
            : 0;
        data.refundRate =
          data.orders > 0
            ? Math.round((data.refunds / data.orders) * 10000) / 100
            : 0;
      });

      // Calculate trends
      const paymentTrends = this.calculatePaymentTrends(dailyTrend);
      const channelTrends = this.calculateChannelTrends(dailyTrend);

      return {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          days: dates.length,
          timezone: "UTC",
        },
        summary: {
          totalOrders,
          totalRefunded,
          grossRevenue: Math.round(grossRevenue * 100) / 100,
          totalRefunds: Math.round(totalRefunds * 100) / 100,
          netRevenue: Math.round(netRevenue * 100) / 100,
          avgOrderValue:
            totalOrders > 0
              ? Math.round((netRevenue / totalOrders) * 100) / 100
              : 0,
          refundRate:
            totalOrders > 0
              ? Math.round((totalRefunded / totalOrders) * 10000) / 100
              : 0,
          daysWithSales: dailyTrend.filter((day) => day.orders > 0).length,
        },
        paymentSummary,
        channelSummary,
        dailyTrend,
        insights: {
          topPaymentMethod:
            Object.entries(paymentSummary).sort(
              (a, b) => b[1].netRevenue - a[1].netRevenue
            )[0]?.[0] || "cash",
          topChannel:
            channelSummary.online.netRevenue > channelSummary.offline.netRevenue
              ? "online"
              : "offline",
          cashDominance: paymentSummary.cash?.percentage > 50,
          digitalAdoption:
            (paymentSummary.upi?.percentage || 0) +
            (paymentSummary.card?.percentage || 0) +
            (paymentSummary.qr?.percentage || 0) +
            (paymentSummary.wallet?.percentage || 0),
          paymentTrends,
          channelTrends,
          riskFactors: {
            highRefundRate: Object.values(paymentSummary).some(
              (p) => p.refundRate > 10
            ),
            paymentMethodConcentration:
              Object.values(paymentSummary).filter((p) => p.percentage > 30)
                .length < 2,
            channelImbalance:
              Math.abs(
                channelSummary.online.percentage -
                  channelSummary.offline.percentage
              ) > 70,
          },
        },
        recommendations: this.generatePaymentRecommendations(
          paymentSummary,
          channelSummary
        ),
      };
    } catch (error) {
      console.error("❌ Payment analytics error:", error);
      return this.getEmptyReportStructure("payment", error.message);
    }
  }

  // CHANNEL PERFORMANCE REPORT - Complete
  static async getChannelPerformanceReport(startDate = null, endDate = null) {
    try {
      const { start, end } = this.normalizeDateRange(startDate, endDate, 90);
      const startUTC = this.toUTC(start);
      const endUTC = this.toUTC(end);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startUTC, lte: endUTC },
          status: { notIn: ["cancelled"] },
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
            },
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
          // REMOVED: cashier relation doesn't exist
        },
        orderBy: { createdAt: "asc" },
      });

      // Add null cashier to orders
      const ordersWithCashier = orders.map((order) => ({
        ...order,
        cashier: null,
        cashierId: null,
      }));

      const validOrders = ordersWithCashier.filter((order) =>
        this.isValidOrder(order)
      );
      const onlineOrders = validOrders.filter((order) => order.customerId);
      const offlineOrders = validOrders.filter((order) => !order.customerId);

      // Calculate metrics for a channel
      const calculateChannelMetrics = (channelOrders, channelName) => {
        const completedOrders = channelOrders.filter((o) =>
          this.COMPLETED_STATUSES.includes(o.status)
        );
        const refundedOrders = channelOrders.filter(
          (o) => o.status === "refunded"
        );

        const totalRevenue = completedOrders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );
        const totalRefunds = Math.abs(
          refundedOrders.reduce((sum, order) => sum + (order.total || 0), 0)
        );
        const netRevenue = Math.max(0, totalRevenue - totalRefunds);
        const orderCount = completedOrders.length;
        const refundCount = refundedOrders.length;

        // Customer analysis (for online only)
        const customerMetrics =
          channelName === "online"
            ? {
                uniqueCustomers: new Set(
                  completedOrders.map((o) => o.customerId)
                ).size,
                repeatCustomers:
                  completedOrders.length -
                  new Set(completedOrders.map((o) => o.customerId)).size,
                newCustomers: completedOrders.filter((o) => {
                  const orderDate = new Date(o.createdAt);
                  const customerCreateDate = new Date(
                    o.customer?.createdAt || orderDate
                  );
                  return (
                    orderDate - customerCreateDate < 7 * 24 * 60 * 60 * 1000
                  ); // Within 7 days
                }).length,
              }
            : null;

        // Product analysis
        const productSales = {};
        const categorySales = {};
        let totalCost = 0;
        let totalItems = 0;

        completedOrders.forEach((order) => {
          order.items.forEach((item) => {
            const productName =
              item.product?.name || item.productName || "Unknown";
            const category = item.product?.category || "Uncategorized";
            const costPrice = item.product?.costPrice || 0;
            const sellPrice = item.price || 0;
            const quantity = item.qty || 0;
            const revenue = sellPrice * quantity;
            const cost = costPrice * quantity;

            productSales[productName] = {
              quantity: (productSales[productName]?.quantity || 0) + quantity,
              revenue: (productSales[productName]?.revenue || 0) + revenue,
              cost: (productSales[productName]?.cost || 0) + cost,
              profit:
                (productSales[productName]?.profit || 0) + (revenue - cost),
            };

            categorySales[category] = {
              quantity: (categorySales[category]?.quantity || 0) + quantity,
              revenue: (categorySales[category]?.revenue || 0) + revenue,
              cost: (categorySales[category]?.cost || 0) + cost,
              profit: (categorySales[category]?.profit || 0) + (revenue - cost),
            };

            totalCost += cost;
            totalItems += quantity;
          });
        });

        const topProducts = Object.entries(productSales)
          .map(([name, data]) => ({
            name,
            quantity: data.quantity,
            revenue: Math.round(data.revenue * 100) / 100,
            cost: Math.round(data.cost * 100) / 100,
            profit: Math.round(data.profit * 100) / 100,
            margin:
              data.revenue > 0
                ? Math.round((data.profit / data.revenue) * 10000) / 100
                : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const topCategories = Object.entries(categorySales)
          .map(([category, data]) => ({
            category,
            quantity: data.quantity,
            revenue: Math.round(data.revenue * 100) / 100,
            profit: Math.round(data.profit * 100) / 100,
            margin:
              data.revenue > 0
                ? Math.round((data.profit / data.revenue) * 10000) / 100
                : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        // Time analysis
        const hourlyDistribution = Array(24).fill(0);
        const dayOfWeekDistribution = Array(7).fill(0);
        const monthlyDistribution = {};

        completedOrders.forEach((order) => {
          const date = new Date(order.createdAt);
          const hour = date.getHours();
          const day = date.getDay();
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;

          hourlyDistribution[hour] += 1;
          dayOfWeekDistribution[day] += 1;
          monthlyDistribution[monthKey] =
            (monthlyDistribution[monthKey] || 0) + 1;
        });

        const peakHour = hourlyDistribution.indexOf(
          Math.max(...hourlyDistribution)
        );
        const peakDay = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ][dayOfWeekDistribution.indexOf(Math.max(...dayOfWeekDistribution))];

        // Profitability
        const grossProfit = Math.round((netRevenue - totalCost) * 100) / 100;
        const grossMargin =
          netRevenue > 0
            ? Math.round((grossProfit / netRevenue) * 10000) / 100
            : 0;
        const avgProfitPerOrder =
          orderCount > 0
            ? Math.round((grossProfit / orderCount) * 100) / 100
            : 0;

        return {
          channel: channelName,
          metrics: {
            totalOrders: orderCount,
            totalRefunds: refundCount,
            grossRevenue: Math.round(totalRevenue * 100) / 100,
            totalRefundAmount: Math.round(totalRefunds * 100) / 100,
            netRevenue: Math.round(netRevenue * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            grossProfit,
            grossMargin,
            avgOrderValue:
              orderCount > 0
                ? Math.round((netRevenue / orderCount) * 100) / 100
                : 0,
            avgProfitPerOrder,
            totalItems,
            avgItemsPerOrder:
              orderCount > 0
                ? Math.round((totalItems / orderCount) * 100) / 100
                : 0,
            refundRate:
              orderCount > 0
                ? Math.round((refundCount / orderCount) * 10000) / 100
                : 0,
            ...(customerMetrics || {}),
            peakHour: `${peakHour.toString().padStart(2, "0")}:00`,
            peakDay,
            busiestMonth:
              Object.entries(monthlyDistribution).sort(
                (a, b) => b[1] - a[1]
              )[0]?.[0] || "N/A",
          },
          topProducts,
          topCategories,
          hourlyDistribution: hourlyDistribution.map((count, hour) => ({
            hour: `${hour.toString().padStart(2, "0")}:00`,
            orders: count,
          })),
          dayOfWeekDistribution: dayOfWeekDistribution.map((count, day) => ({
            day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day],
            orders: count,
          })),
          monthlyTrend: Object.entries(monthlyDistribution)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, orders]) => ({ month, orders })),
        };
      };

      const onlineMetrics = calculateChannelMetrics(onlineOrders, "online");
      const offlineMetrics = calculateChannelMetrics(offlineOrders, "offline");

      // Combined summary
      const totalOrders = validOrders.filter((o) =>
        this.COMPLETED_STATUSES.includes(o.status)
      ).length;
      const totalNetRevenue =
        onlineMetrics.metrics.netRevenue + offlineMetrics.metrics.netRevenue;
      const onlinePercentage =
        totalOrders > 0
          ? Math.round(
              (onlineMetrics.metrics.totalOrders / totalOrders) * 10000
            ) / 100
          : 0;

      // Growth comparison (last 30 days vs previous 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const recentOrders = validOrders.filter(
        (order) => new Date(order.createdAt) >= thirtyDaysAgo
      );
      const previousOrders = validOrders.filter(
        (order) =>
          new Date(order.createdAt) >= sixtyDaysAgo &&
          new Date(order.createdAt) < thirtyDaysAgo
      );

      const recentOnline = recentOrders.filter(
        (order) => order.customerId
      ).length;
      const previousOnline = previousOrders.filter(
        (order) => order.customerId
      ).length;
      const recentOffline = recentOrders.filter(
        (order) => !order.customerId
      ).length;
      const previousOffline = previousOrders.filter(
        (order) => !order.customerId
      ).length;

      const onlineGrowth =
        previousOnline > 0
          ? Math.round(
              ((recentOnline - previousOnline) / previousOnline) * 10000
            ) / 100
          : recentOnline > 0
          ? 100
          : 0;

      const offlineGrowth =
        previousOffline > 0
          ? Math.round(
              ((recentOffline - previousOffline) / previousOffline) * 10000
            ) / 100
          : recentOffline > 0
          ? 100
          : 0;

      // Customer analysis
      const customerInsights =
        onlineOrders.length > 0
          ? {
              totalCustomers: new Set(onlineOrders.map((o) => o.customerId))
                .size,
              averageOrdersPerCustomer:
                onlineMetrics.metrics.uniqueCustomers > 0
                  ? Math.round(
                      (onlineMetrics.metrics.totalOrders /
                        onlineMetrics.metrics.uniqueCustomers) *
                        100
                    ) / 100
                  : 0,
              customerRetentionRate: this.calculateRetentionRate(onlineOrders),
              lifetimeValue: this.calculateLifetimeValue(onlineOrders),
            }
          : null;

      return {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          days: Math.round((end - start) / (1000 * 60 * 60 * 24)),
        },
        summary: {
          totalOrders,
          totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
          onlinePercentage,
          revenueShareOnline:
            totalNetRevenue > 0
              ? Math.round(
                  (onlineMetrics.metrics.netRevenue / totalNetRevenue) * 10000
                ) / 100
              : 0,
          onlineGrowth,
          offlineGrowth,
          overallGrossMargin:
            totalNetRevenue > 0
              ? Math.round(
                  ((onlineMetrics.metrics.grossProfit +
                    offlineMetrics.metrics.grossProfit) /
                    totalNetRevenue) *
                    10000
                ) / 100
              : 0,
          channelComparison: {
            online: {
              orderShare: onlinePercentage,
              revenueShare:
                totalNetRevenue > 0
                  ? Math.round(
                      (onlineMetrics.metrics.netRevenue / totalNetRevenue) *
                        10000
                    ) / 100
                  : 0,
              avgOrderValue: onlineMetrics.metrics.avgOrderValue,
              profitMargin: onlineMetrics.metrics.grossMargin,
            },
            offline: {
              orderShare: 100 - onlinePercentage,
              revenueShare:
                totalNetRevenue > 0
                  ? Math.round(
                      (offlineMetrics.metrics.netRevenue / totalNetRevenue) *
                        10000
                    ) / 100
                  : 0,
              avgOrderValue: offlineMetrics.metrics.avgOrderValue,
              profitMargin: offlineMetrics.metrics.grossMargin,
            },
          },
        },
        channelDetails: {
          online: onlineMetrics,
          offline: offlineMetrics,
        },
        customerInsights,
        insights: {
          strengths: this.identifyChannelStrengths(
            onlineMetrics,
            offlineMetrics
          ),
          weaknesses: this.identifyChannelWeaknesses(
            onlineMetrics,
            offlineMetrics
          ),
          opportunities: this.identifyChannelOpportunities(
            onlineMetrics,
            offlineMetrics
          ),
          threats: this.identifyChannelThreats(onlineMetrics, offlineMetrics),
          bestPerforming:
            onlineMetrics.metrics.grossMargin >
            offlineMetrics.metrics.grossMargin
              ? "online"
              : "offline",
          growthPotential: onlineGrowth > offlineGrowth ? "online" : "offline",
          synergyOpportunities: this.findSynergyOpportunities(
            onlineMetrics,
            offlineMetrics
          ),
        },
        recommendations: this.generateChannelRecommendations(
          onlineMetrics,
          offlineMetrics,
          {
            onlineGrowth,
            offlineGrowth,
            customerInsights,
          }
        ),
      };
    } catch (error) {
      console.error("❌ Channel performance error:", error);
      return this.getEmptyReportStructure("channel", error.message);
    }
  }

  // LOW STOCK REPORT - Enhanced
  static async getLowStockReport(threshold = 10) {
    try {
      const products = await prisma.product.findMany({
        where: {
          stock: { lte: threshold },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          costPrice: true,
          stock: true,
          minStockLevel: true,
          reorderPoint: true,
          isActive: true,
          category: true, // Direct scalar field access
          updatedAt: true,
        },
        orderBy: [{ stock: "asc" }, { name: "asc" }],
      });

      // Get sales data for reorder calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const salesData = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            createdAt: { gte: thirtyDaysAgo },
            status: { in: this.COMPLETED_STATUSES },
          },
        },
        _sum: { qty: true },
        _count: { id: true },
      });

      const salesMap = salesData.reduce((map, item) => {
        map[item.productId] = {
          totalSold: item._sum.qty || 0,
          orderCount: item._count.id || 0,
        };
        return map;
      }, {});

      // Calculate reorder suggestions
      const productsWithSuggestions = products.map((product) => {
        const sales = salesMap[product.id] || { totalSold: 0, orderCount: 0 };
        const avgDailySales = sales.totalSold / 30;
        const leadTime = 7; // Default since you don't have supplier relation
        const safetyStock = Math.ceil(avgDailySales * leadTime * 1.5);

        let urgency = "low";
        let reorderSuggestion = "";
        let suggestedReorderQty = 0;

        if (product.stock === 0) {
          urgency = "critical";
          reorderSuggestion = "OUT OF STOCK - Immediate reorder required";
          suggestedReorderQty = Math.max(safetyStock * 2, 50);
        } else if (product.stock <= 3) {
          urgency = "high";
          reorderSuggestion = `CRITICAL - Only ${product.stock} units left. Reorder immediately.`;
          suggestedReorderQty = Math.max(safetyStock * 1.5, 30);
        } else if (product.stock <= threshold) {
          urgency = "medium";
          reorderSuggestion = `LOW STOCK - ${product.stock} units left. Consider reordering.`;
          suggestedReorderQty = Math.max(safetyStock, 20);
        } else {
          urgency = "low";
          reorderSuggestion = `Monitoring - ${product.stock} units in stock.`;
          suggestedReorderQty = Math.max(safetyStock - product.stock, 0);
        }

        // Adjust based on sales velocity
        if (sales.totalSold > 100) {
          suggestedReorderQty = Math.ceil(suggestedReorderQty * 1.2);
        }

        // Handle missing fields
        const costPrice = product.costPrice || product.price * 0.6;
        const minStockLevel = product.minStockLevel || 5;
        const reorderPoint = product.reorderPoint || 10;
        const sku = product.sku || "N/A";
        const category = product.category || "Uncategorized";

        return {
          id: product.id,
          name: product.name,
          sku: sku,
          description: product.description,
          category: category,
          price: product.price,
          costPrice: costPrice,
          stock: product.stock,
          minStockLevel: minStockLevel,
          reorderPoint: reorderPoint,
          supplier: "No supplier", // Default since no supplier relation
          leadTime: leadTime,
          salesLast30Days: sales.totalSold,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          daysOfStock:
            avgDailySales > 0
              ? Math.round((product.stock / avgDailySales) * 100) / 100
              : 999,
          reorderSuggestion,
          urgency,
          suggestedReorderQty: Math.ceil(suggestedReorderQty),
          estimatedCost: Math.ceil(suggestedReorderQty) * costPrice,
          lastRestock: product.updatedAt,
          hasBeenOutOfStock: product.stock === 0,
          stockTurnover:
            costPrice > 0
              ? Math.round(
                  ((sales.totalSold * product.price) /
                    (product.stock * costPrice)) *
                    100
                ) / 100
              : 0,
        };
      });

      // Calculate summary metrics
      const criticalProducts = productsWithSuggestions.filter(
        (p) => p.urgency === "critical"
      );
      const highPriorityProducts = productsWithSuggestions.filter(
        (p) => p.urgency === "high"
      );
      const mediumPriorityProducts = productsWithSuggestions.filter(
        (p) => p.urgency === "medium"
      );

      const totalInventoryValue = productsWithSuggestions.reduce(
        (sum, p) => sum + p.stock * p.costPrice,
        0
      );

      const totalReorderCost = productsWithSuggestions.reduce(
        (sum, p) => sum + p.estimatedCost,
        0
      );

      // Identify fast-moving items
      const fastMoving = productsWithSuggestions
        .filter((p) => p.salesLast30Days > 50)
        .sort((a, b) => b.salesLast30Days - a.salesLast30Days)
        .slice(0, 5);

      // Identify slow-moving items
      const slowMoving = productsWithSuggestions
        .filter((p) => p.salesLast30Days < 5 && p.stock > 20)
        .sort((a, b) => a.salesLast30Days - b.salesLast30Days)
        .slice(0, 5);

      // Group by category
      const criticalCategories = productsWithSuggestions
        .filter((p) => p.urgency === "critical")
        .reduce((groups, product) => {
          const category = product.category || "Uncategorized";
          if (!groups[category]) groups[category] = [];
          groups[category].push(product);
          return groups;
        }, {});

      return {
        generatedAt: new Date().toISOString(),
        threshold,
        summary: {
          totalLowStock: products.length,
          outOfStock: products.filter((p) => p.stock === 0).length,
          criticalStock: criticalProducts.length,
          highPriority: highPriorityProducts.length,
          mediumPriority: mediumPriorityProducts.length,
          lowPriority: productsWithSuggestions.filter(
            (p) => p.urgency === "low"
          ).length,
          totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
          totalReorderCost: Math.round(totalReorderCost * 100) / 100,
          avgDaysOfStock:
            productsWithSuggestions.length > 0
              ? Math.round(
                  (productsWithSuggestions.reduce(
                    (sum, p) => sum + p.daysOfStock,
                    0
                  ) /
                    productsWithSuggestions.length) *
                    100
                ) / 100
              : 0,
        },
        products: productsWithSuggestions.sort((a, b) => {
          const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (
            urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
            a.daysOfStock - b.daysOfStock
          );
        }),
        insights: {
          fastMovingItems: fastMoving,
          slowMovingItems: slowMoving,
          criticalCategories: criticalCategories,
          supplierPerformance: [], // Empty since no supplier
          restockPriority: productsWithSuggestions
            .filter((p) => p.urgency === "critical" || p.urgency === "high")
            .sort((a, b) => {
              const urgencyOrder = { critical: 0, high: 1 };
              return (
                urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
                b.suggestedReorderQty - a.suggestedReorderQty
              );
            })
            .slice(0, 10),
          cashflowImpact: {
            immediate: criticalProducts.reduce(
              (sum, p) => sum + p.estimatedCost,
              0
            ),
            shortTerm: highPriorityProducts.reduce(
              (sum, p) => sum + p.estimatedCost,
              0
            ),
            total: totalReorderCost,
          },
        },
        recommendations: productsWithSuggestions
          .filter((p) => p.urgency === "critical" || p.urgency === "high")
          .map((p) => ({
            product: p.name,
            action: p.reorderSuggestion,
            quantity: p.suggestedReorderQty,
            estimatedCost: p.estimatedCost,
            priority: p.urgency === "critical" ? "HIGH" : "MEDIUM",
          }))
          .slice(0, 10),
      };
    } catch (error) {
      console.error("❌ Low stock report error:", error);
      return {
        generatedAt: new Date().toISOString(),
        threshold,
        summary: {
          totalLowStock: 0,
          outOfStock: 0,
          criticalStock: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          totalInventoryValue: 0,
          totalReorderCost: 0,
          avgDaysOfStock: 0,
        },
        products: [],
        insights: {
          fastMovingItems: [],
          slowMovingItems: [],
          criticalCategories: {},
          supplierPerformance: [],
          restockPriority: [],
          cashflowImpact: { immediate: 0, shortTerm: 0, total: 0 },
        },
        recommendations: [],
        error: error.message,
      };
    }
  }
  // CUSTOMER PURCHASE HISTORY - Complete
  static async getCustomerPurchaseHistory(customerId = null, limit = 50) {
    try {
      let customers;

      if (customerId) {
        // Single customer detail
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          include: {
            orders: {
              where: {
                status: { notIn: this.EXCLUDED_STATUSES },
              },
              include: {
                items: {
                  include: {
                    product: {
                      select: {
                        name: true,
                        price: true,
                        category: true,
                      },
                    },
                  },
                },
                // REMOVED: cashier relation doesn't exist
              },
              orderBy: { createdAt: "desc" },
            },
            // REMOVED: addresses and notes don't exist in schema
          },
        });

        if (!customer) {
          throw new AppError(`Customer ${customerId} not found`, 404);
        }

        customers = [customer];
      } else {
        // All customers with summary
        customers = await prisma.customer.findMany({
          include: {
            orders: {
              where: {
                status: { in: this.COMPLETED_STATUSES },
              },
              select: {
                id: true,
                total: true,
                createdAt: true,
                items: { select: { qty: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            _count: {
              select: { orders: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
      }

      // Process customer data
      const customerReports = customers.map((customer) => {
        const validOrders = customer.orders.filter(
          (order) =>
            this.isValidOrder(order) &&
            this.COMPLETED_STATUSES.includes(order.status)
        );

        const refundedOrders = customer.orders.filter(
          (order) => order.status === "refunded"
        );

        const totalSpent = validOrders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );
        const totalRefunded = Math.abs(
          refundedOrders.reduce((sum, order) => sum + (order.total || 0), 0)
        );
        const netSpent = Math.max(0, totalSpent - totalRefunded);
        const orderCount = validOrders.length;
        const refundCount = refundedOrders.length;

        const avgOrderValue = orderCount > 0 ? netSpent / orderCount : 0;

        // Calculate favorite products
        const productFrequency = {};
        const categoryFrequency = {};
        const paymentMethodFrequency = {};
        const channelFrequency = { online: 0, offline: 0 };

        validOrders.forEach((order) => {
          // Products
          if (order.items) {
            order.items.forEach((item) => {
              const productName = item.product?.name || "Unknown";
              productFrequency[productName] =
                (productFrequency[productName] || 0) + (item.qty || 1);

              const category = item.product?.category || "Uncategorized";
              categoryFrequency[category] =
                (categoryFrequency[category] || 0) + 1;
            });
          }

          // Payment methods
          const paymentMethod = order.paymentMethod || "cash";
          paymentMethodFrequency[paymentMethod] =
            (paymentMethodFrequency[paymentMethod] || 0) + 1;

          // Channels
          const channel = order.customerId ? "online" : "offline";
          channelFrequency[channel] += 1;
        });

        const favoriteProducts = Object.entries(productFrequency)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        const favoriteCategories = Object.entries(categoryFrequency)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        // Recent activity
        const recentOrders = validOrders.slice(0, 10).map((order) => ({
          id: order.id,
          date: order.createdAt.toISOString().split("T")[0],
          time:
            order.createdAt.toISOString().split("T")[1]?.substring(0, 5) || "",
          total: order.total || 0,
          items: order.items?.length || 0,
          paymentMethod: order.paymentMethod || "cash",
          channel: order.customerId ? "online" : "offline",
          cashier: "System", // Default since no cashier relation
        }));

        // Purchase pattern
        const orderDates = validOrders.map((o) => new Date(o.createdAt));
        const firstOrder =
          orderDates.length > 0
            ? new Date(Math.min(...orderDates.map((d) => d.getTime())))
            : null;
        const lastOrder =
          orderDates.length > 0
            ? new Date(Math.max(...orderDates.map((d) => d.getTime())))
            : null;

        const daysAsCustomer = firstOrder
          ? Math.ceil((new Date() - firstOrder) / (1000 * 60 * 60 * 24))
          : 0;
        const avgDaysBetweenOrders =
          this.calculateAverageDaysBetweenOrders(orderDates);

        const monthlySpending = this.calculateMonthlySpending(validOrders);
        const seasonalPattern = this.analyzeSeasonalPattern(validOrders);

        // Customer value metrics
        const customerValue = {
          lifetimeValue: netSpent,
          avgOrderValue,
          orderFrequency: orderCount / Math.max(1, daysAsCustomer / 30), // orders per month
          recency: lastOrder
            ? Math.ceil((new Date() - lastOrder) / (1000 * 60 * 60 * 24))
            : null,
          monetaryScore: this.calculateMonetaryScore(netSpent, avgOrderValue),
          frequencyScore: this.calculateFrequencyScore(
            orderCount,
            daysAsCustomer
          ),
          recencyScore: this.calculateRecencyScore(lastOrder),
          clvScore:
            Math.round((netSpent / Math.max(1, daysAsCustomer)) * 100) / 100, // CLV per day
        };

        // Customer segmentation
        const segment = this.segmentCustomer(customerValue);

        // Predictions
        const predictedNextPurchase = this.predictNextPurchase(orderDates);
        const churnRisk = this.calculateChurnRisk(customerValue);

        return {
          customerId: customer.id,
          customerName: customer.name,
          contact: {
            email: customer.email || "No email",
            phone: customer.phone || "No phone",
            altPhone: customer.altPhone || null, // Might be null
            addresses: [], // Empty since addresses field doesn't exist
          },
          demographics: {
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt || null, // Might be null for old records
            notes: [], // Empty since notes field doesn't exist
            tags: customer.tags || [], // Might be empty array
          },
          summary: {
            totalOrders: orderCount,
            refundedOrders: refundCount,
            grossSpent: Math.round(totalSpent * 100) / 100,
            totalRefunded: Math.round(totalRefunded * 100) / 100,
            netSpent: Math.round(netSpent * 100) / 100,
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,
            firstOrder: firstOrder
              ? firstOrder.toISOString().split("T")[0]
              : "No orders",
            lastOrder: lastOrder
              ? lastOrder.toISOString().split("T")[0]
              : "No orders",
            daysAsCustomer: daysAsCustomer,
            refundRate:
              orderCount > 0
                ? Math.round((refundCount / orderCount) * 10000) / 100
                : 0,
          },
          behavior: {
            favoriteProducts,
            favoriteCategories,
            preferredPaymentMethods: Object.entries(paymentMethodFrequency)
              .map(([method, count]) => ({
                method,
                count,
                percentage: Math.round((count / orderCount) * 10000) / 100,
              }))
              .sort((a, b) => b.count - a.count),
            channelPreference: channelFrequency,
            avgDaysBetweenOrders: Math.round(avgDaysBetweenOrders * 100) / 100,
            monthlySpending,
            seasonalPattern,
            peakShoppingHours: this.analyzeShoppingHours(validOrders),
            peakShoppingDays: this.analyzeShoppingDays(validOrders),
          },
          valueMetrics: {
            ...customerValue,
            segment,
            predictedNextPurchase,
            churnRisk: Math.round(churnRisk * 100) / 100,
            loyaltyScore: this.calculateLoyaltyScore(
              customerValue,
              refundCount
            ),
            potentialValue: this.calculatePotentialValue(
              customerValue,
              segment
            ),
          },
          recentActivity: recentOrders,
          allOrders: validOrders.slice(0, 50).map((order) => ({
            id: order.id,
            date: order.createdAt.toISOString(),
            total: order.total || 0,
            status: order.status || "unknown",
            paymentMethod: order.paymentMethod || "cash",
            items: (order.items || []).map((item) => ({
              product: item.product?.name || "Unknown",
              category: item.product?.category || "Uncategorized",
              quantity: item.qty || 0,
              price: item.price || 0,
              total: (item.qty || 0) * (item.price || 0),
            })),
          })),
          insights: {
            opportunities: this.identifyCustomerOpportunities(
              customerValue,
              favoriteProducts,
              favoriteCategories
            ),
            risks: this.identifyCustomerRisks(
              customerValue,
              refundCount,
              churnRisk
            ),
            recommendations: this.generateCustomerRecommendations(
              segment,
              customerValue,
              {
                favoriteProducts,
                favoriteCategories,
                channelFrequency,
              }
            ),
          },
        };
      });

      const result = {
        generatedAt: new Date().toISOString(),
        reportType: customerId ? "individual" : "summary",
      };

      if (customerId) {
        result.customer = customerReports[0];
      } else {
        result.customers = customerReports;
        result.summary = {
          totalCustomers: customerReports.length,
          totalOrders: customerReports.reduce(
            (sum, c) => sum + c.summary.totalOrders,
            0
          ),
          totalRevenue: customerReports.reduce(
            (sum, c) => sum + c.summary.netSpent,
            0
          ),
          avgCustomerValue:
            customerReports.length > 0
              ? Math.round(
                  (customerReports.reduce(
                    (sum, c) => sum + c.valueMetrics.lifetimeValue,
                    0
                  ) /
                    customerReports.length) *
                    100
                ) / 100
              : 0,
          segmentDistribution:
            this.calculateSegmentDistribution(customerReports),
          topSpenders: customerReports
            .sort((a, b) => b.summary.netSpent - a.summary.netSpent)
            .slice(0, 10)
            .map((c) => ({
              id: c.customerId,
              name: c.customerName,
              totalSpent: c.summary.netSpent,
              orderCount: c.summary.totalOrders,
              lastOrder: c.summary.lastOrder,
            })),
          customerHealth: {
            activeCustomers: customerReports.filter(
              (c) => c.valueMetrics.recency < 30
            ).length,
            atRiskCustomers: customerReports.filter(
              (c) => c.valueMetrics.churnRisk > 50
            ).length,
            loyalCustomers: customerReports.filter(
              (c) =>
                c.valueMetrics.segment === "champion" ||
                c.valueMetrics.segment === "loyal"
            ).length,
            newCustomers: customerReports.filter(
              (c) => c.summary.daysAsCustomer < 30
            ).length,
          },
        };
      }

      return result;
    } catch (error) {
      console.error("❌ Customer history report error:", error);
      return {
        generatedAt: new Date().toISOString(),
        error: error.message,
        customers: [],
        summary: {
          totalCustomers: 0,
          totalOrders: 0,
          totalRevenue: 0,
          avgCustomerValue: 0,
          segmentDistribution: {},
          topSpenders: [],
          customerHealth: {
            activeCustomers: 0,
            atRiskCustomers: 0,
            loyalCustomers: 0,
            newCustomers: 0,
          },
        },
      };
    }
  }

  // SALES TREND REPORT - Complete
  static async getSalesTrendReport(period = "weekly", weeks = 8) {
    try {
      const endDate = new Date();
      const startDate = new Date();

      if (period === "weekly") {
        startDate.setDate(endDate.getDate() - weeks * 7);
      } else if (period === "monthly") {
        startDate.setMonth(endDate.getMonth() - weeks);
      } else if (period === "daily") {
        startDate.setDate(endDate.getDate() - weeks);
      } else {
        throw new AppError(
          'Invalid period. Use "daily", "weekly", or "monthly"',
          400
        );
      }

      const { start, end } = this.normalizeDateRange(startDate, endDate, 1);
      const startUTC = this.toUTC(start);
      const endUTC = this.toUTC(end);

      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startUTC, lte: endUTC },
          AND: [{ items: { some: {} } }, { total: { gt: 0 } }],
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  price: true,
                  costPrice: true,
                },
              },
            },
          },
          customer: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by period
      const periodData = {};
      const validOrders = orders.filter((order) => this.isValidOrder(order));

      validOrders.forEach((order) => {
        let periodKey;
        const orderDate = new Date(order.createdAt);

        if (period === "daily") {
          periodKey = orderDate.toISOString().split("T")[0];
        } else if (period === "weekly") {
          periodKey = this.getWeekNumber(orderDate);
        } else {
          // monthly
          periodKey = `${orderDate.getFullYear()}-${(orderDate.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
        }

        if (!periodData[periodKey]) {
          periodData[periodKey] = {
            period: periodKey,
            startDate: orderDate.toISOString().split("T")[0],
            totalSales: 0,
            totalCost: 0,
            orders: 0,
            refunds: 0,
            items: 0,
            customers: new Set(),
            products: {},
            categories: {},
            paymentMethods: {},
            channels: { online: 0, offline: 0 },
          };
        }

        const periodEntry = periodData[periodKey];
        const isRefund = order.status === "refunded";
        const amount = Math.abs(order.total || 0);
        const channel = order.customerId ? "online" : "offline";

        if (isRefund) {
          periodEntry.refunds += amount;
          periodEntry.totalSales -= amount;
        } else {
          periodEntry.totalSales += amount;
          periodEntry.orders += 1;
          if (order.customerId) periodEntry.customers.add(order.customerId);
          periodEntry.channels[channel] += 1;
        }

        // Process items for cost and product analysis
        order.items.forEach((item) => {
          if (isRefund) {
            periodEntry.items -= item.qty || 0;
            periodEntry.totalCost -=
              (item.product?.costPrice || 0) * (item.qty || 0);
          } else {
            periodEntry.items += item.qty || 0;
            periodEntry.totalCost +=
              (item.product?.costPrice || item.price * 0.6) * (item.qty || 0);
          }

          // Product tracking
          const productId = item.productId || "unknown";
          const productName =
            item.product?.name || item.productName || "Unknown";
          const category = item.product?.category || "Uncategorized";

          if (!periodEntry.products[productId]) {
            periodEntry.products[productId] = {
              name: productName,
              quantity: 0,
              revenue: 0,
              cost: 0,
            };
          }

          const itemQuantity = item.qty || 0;
          const itemRevenue = (item.price || 0) * itemQuantity;
          const itemCost =
            (item.product?.costPrice || item.price * 0.6) * itemQuantity;

          if (isRefund) {
            periodEntry.products[productId].quantity -= itemQuantity;
            periodEntry.products[productId].revenue -= itemRevenue;
            periodEntry.products[productId].cost -= itemCost;
          } else {
            periodEntry.products[productId].quantity += itemQuantity;
            periodEntry.products[productId].revenue += itemRevenue;
            periodEntry.products[productId].cost += itemCost;
          }

          // Category tracking
          if (!periodEntry.categories[category]) {
            periodEntry.categories[category] = {
              quantity: 0,
              revenue: 0,
              cost: 0,
            };
          }

          if (isRefund) {
            periodEntry.categories[category].quantity -= itemQuantity;
            periodEntry.categories[category].revenue -= itemRevenue;
            periodEntry.categories[category].cost -= itemCost;
          } else {
            periodEntry.categories[category].quantity += itemQuantity;
            periodEntry.categories[category].revenue += itemRevenue;
            periodEntry.categories[category].cost += itemCost;
          }
        });

        // Payment method tracking
        const paymentMethod = order.paymentMethod || "cash";
        if (!periodEntry.paymentMethods[paymentMethod]) {
          periodEntry.paymentMethods[paymentMethod] = 0;
        }
        periodEntry.paymentMethods[paymentMethod] += isRefund ? -1 : 1;
      });

      // Convert to array and calculate metrics
      const trend = Object.values(periodData)
        .map((period) => {
          const netSales = Math.max(0, period.totalSales);
          const netCost = Math.max(0, period.totalCost);
          const grossProfit = netSales - netCost;
          const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

          const topProducts = Object.values(period.products)
            .filter((p) => p.quantity > 0)
            .map((p) => ({
              ...p,
              profit: p.revenue - p.cost,
              margin:
                p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          const topCategories = Object.entries(period.categories)
            .filter(([_, data]) => data.quantity > 0)
            .map(([category, data]) => ({
              category,
              ...data,
              profit: data.revenue - data.cost,
              margin:
                data.revenue > 0
                  ? ((data.revenue - data.cost) / data.revenue) * 100
                  : 0,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3);

          const paymentBreakdown = Object.entries(period.paymentMethods)
            .filter(([_, count]) => count > 0)
            .map(([method, count]) => ({
              method,
              count: Math.max(0, count),
              percentage:
                period.orders > 0
                  ? (Math.max(0, count) / period.orders) * 100
                  : 0,
            }))
            .sort((a, b) => b.count - a.count);

          const channelBreakdown = {
            online: period.channels.online,
            offline: period.channels.offline,
            onlinePercentage:
              period.orders > 0
                ? (period.channels.online / period.orders) * 100
                : 0,
          };

          return {
            ...period,
            period: period.period,
            startDate: period.startDate,
            netSales: Math.round(netSales * 100) / 100,
            netCost: Math.round(netCost * 100) / 100,
            grossProfit: Math.round(grossProfit * 100) / 100,
            grossMargin: Math.round(grossMargin * 100) / 100,
            refunds: Math.round(period.refunds * 100) / 100,
            avgOrderValue:
              period.orders > 0
                ? Math.round((netSales / period.orders) * 100) / 100
                : 0,
            avgItemsPerOrder:
              period.orders > 0
                ? Math.round((period.items / period.orders) * 100) / 100
                : 0,
            uniqueCustomers: period.customers.size,
            customerAcquisition: period.customers.size,
            repeatRate:
              period.orders > 0
                ? ((period.orders - period.customers.size) / period.orders) *
                  100
                : 0,
            topProducts,
            topCategories,
            paymentBreakdown,
            channelBreakdown,
            items: Math.max(0, period.items),
          };
        })
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      // Calculate overall metrics
      const totalRevenue = trend.reduce(
        (sum, period) => sum + period.netSales,
        0
      );
      const totalCost = trend.reduce((sum, period) => sum + period.netCost, 0);
      const totalProfit = totalRevenue - totalCost;
      const totalMargin =
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const totalOrders = trend.reduce((sum, period) => sum + period.orders, 0);
      const totalItems = trend.reduce((sum, period) => sum + period.items, 0);

      const avgRevenuePerPeriod =
        trend.length > 0 ? totalRevenue / trend.length : 0;
      const avgOrdersPerPeriod =
        trend.length > 0 ? totalOrders / trend.length : 0;
      const avgItemsPerPeriod =
        trend.length > 0 ? totalItems / trend.length : 0;

      // Calculate growth rates
      const growthMetrics = this.calculateGrowthMetrics(trend);

      // Identify patterns
      const patterns = this.identifyTrendPatterns(trend);

      return {
        period,
        dateRange: {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          periods: trend.length,
        },
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalProfit: Math.round(totalProfit * 100) / 100,
          totalMargin: Math.round(totalMargin * 100) / 100,
          totalOrders,
          totalItems,
          avgRevenuePerPeriod: Math.round(avgRevenuePerPeriod * 100) / 100,
          avgOrdersPerPeriod: Math.round(avgOrdersPerPeriod * 100) / 100,
          avgItemsPerPeriod: Math.round(avgItemsPerPeriod * 100) / 100,
          avgOrderValue:
            totalOrders > 0
              ? Math.round((totalRevenue / totalOrders) * 100) / 100
              : 0,
          avgItemsPerOrder:
            totalOrders > 0
              ? Math.round((totalItems / totalOrders) * 100) / 100
              : 0,
        },
        trend,
        growthMetrics,
        patterns,
        insights: {
          bestPeriod:
            trend.length > 0
              ? trend.sort((a, b) => b.netSales - a.netSales)[0]
              : null,
          worstPeriod:
            trend.length > 0
              ? trend.sort((a, b) => a.netSales - b.netSales)[0]
              : null,
          consistencyScore: this.calculateConsistencyScore(trend),
          seasonality: this.analyzeSeasonality(trend, period),
          forecast: this.generateForecast(trend, period),
          recommendations: this.generateTrendRecommendations(
            trend,
            patterns,
            growthMetrics
          ),
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          dataPoints: {
            totalOrdersAnalyzed: validOrders.length,
            periods: trend.length,
            productsTracked: new Set(
              trend.flatMap((p) => Object.keys(p.products))
            ).size,
            categoriesTracked: new Set(
              trend.flatMap((p) => Object.keys(p.categories))
            ).size,
          },
        },
      };
    } catch (error) {
      console.error("❌ Sales trend report error:", error);
      return this.getEmptyReportStructure("trend", error.message);
    }
  }

  // INVENTORY VALUATION REPORT - Complete
  static async getInventoryValuationReport() {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        // Use select instead of include for scalar fields
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          costPrice: true,
          stock: true,
          minStockLevel: true,
          reorderPoint: true,
          isActive: true,
          category: true, // This is a scalar String field
          updatedAt: true,
          createdAt: true,
          // Check if you have these relations in your schema:
          // supplierId: true, // If you have supplier relation
        },
        orderBy: { name: "asc" },
      });

      // If you have a Supplier model, fetch suppliers separately
      let suppliers = {};
      try {
        // Only include if Supplier model exists in your schema
        const supplierRecords = await prisma.supplier.findMany({
          select: { id: true, name: true },
        });
        suppliers = supplierRecords.reduce((map, s) => {
          map[s.id] = s.name;
          return map;
        }, {});
      } catch (supplierError) {
        console.log(
          "⚠️ Supplier model not found or error:",
          supplierError.message
        );
      }

      // Get sales data for turnover calculation
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const salesData = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            createdAt: { gte: ninetyDaysAgo },
            status: { in: this.COMPLETED_STATUSES },
          },
        },
        _sum: { qty: true },
        _count: { id: true },
      });

      const salesMap = salesData.reduce((map, item) => {
        map[item.productId] = item._sum.qty || 0;
        return map;
      }, {});

      // Calculate valuation and metrics
      const valuation = products.map((product) => {
        const costPrice = product.costPrice || product.price * 0.6;
        const sellPrice = product.price;
        const stock = product.stock || 0;
        const costValue = costPrice * stock;
        const retailValue = sellPrice * stock;
        const potentialProfit = (sellPrice - costPrice) * stock;
        const profitMargin =
          sellPrice > 0 ? ((sellPrice - costPrice) / sellPrice) * 100 : 0;

        const salesLast90Days = salesMap[product.id] || 0;
        const avgMonthlySales = salesLast90Days / 3;
        const monthsOfStock =
          avgMonthlySales > 0 ? stock / avgMonthlySales : 999;
        const stockTurnover = avgMonthlySales > 0 ? avgMonthlySales / stock : 0;

        let status = "Healthy";
        let statusColor = "green";

        if (stock === 0) {
          status = "Out of Stock";
          statusColor = "red";
        } else if (monthsOfStock > 6) {
          status = "Overstocked";
          statusColor = "orange";
        } else if (monthsOfStock < 0.5) {
          status = "Low Stock";
          statusColor = "yellow";
        } else if (stock < (product.minStockLevel || 5)) {
          status = "Below Minimum";
          statusColor = "red";
        }

        // Get supplier name if supplier relation exists
        let supplierName = "No supplier";
        // If you have supplierId field:
        // if (product.supplierId && suppliers[product.supplierId]) {
        //   supplierName = suppliers[product.supplierId];
        // }

        return {
          id: product.id,
          name: product.name,
          sku: product.sku || "N/A",
          description: product.description || "",
          category: product.category || "Uncategorized", // Direct access to scalar field
          supplier: supplierName,
          costPrice: Math.round(costPrice * 100) / 100,
          sellPrice: Math.round(sellPrice * 100) / 100,
          stock: stock,
          minStockLevel: product.minStockLevel || 5,
          reorderPoint: product.reorderPoint || 10,
          costValue: Math.round(costValue * 100) / 100,
          retailValue: Math.round(retailValue * 100) / 100,
          potentialProfit: Math.round(potentialProfit * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          salesLast90Days: salesLast90Days,
          avgMonthlySales: Math.round(avgMonthlySales * 100) / 100,
          monthsOfStock: Math.round(monthsOfStock * 100) / 100,
          stockTurnover: Math.round(stockTurnover * 100) / 100,
          status,
          statusColor,
          lastUpdated: product.updatedAt,
          createdAt: product.createdAt,
        };
      });

      // Calculate summary metrics
      const totalCostValue = valuation.reduce((sum, p) => sum + p.costValue, 0);
      const totalRetailValue = valuation.reduce(
        (sum, p) => sum + p.retailValue,
        0
      );
      const totalPotentialProfit = valuation.reduce(
        (sum, p) => sum + p.potentialProfit,
        0
      );
      const totalStock = valuation.reduce((sum, p) => sum + p.stock, 0);

      const avgProfitMargin =
        valuation.length > 0
          ? valuation.reduce((sum, p) => sum + p.profitMargin, 0) /
            valuation.length
          : 0;

      const avgMonthsOfStock =
        valuation.length > 0
          ? valuation.reduce((sum, p) => sum + p.monthsOfStock, 0) /
            valuation.length
          : 0;

      // Categorize inventory
      const inventoryCategories = {
        fastMoving: valuation.filter((p) => p.salesLast90Days > 100),
        slowMoving: valuation.filter(
          (p) => p.salesLast90Days < 10 && p.stock > 20
        ),
        nonMoving: valuation.filter(
          (p) => p.salesLast90Days === 0 && p.stock > 0
        ),
        outOfStock: valuation.filter((p) => p.stock === 0),
        overstocked: valuation.filter((p) => p.monthsOfStock > 6),
        healthy: valuation.filter(
          (p) =>
            p.status === "Healthy" &&
            p.monthsOfStock >= 0.5 &&
            p.monthsOfStock <= 6
        ),
      };

      // Group by category (using the scalar field)
      const groupByCategory = (items) => {
        return items.reduce((groups, item) => {
          const category = item.category || "Uncategorized";
          if (!groups[category]) groups[category] = [];
          groups[category].push(item);
          return groups;
        }, {});
      };

      // Calculate ABC analysis (simplified version)
      const performABCAnalysis = (items) => {
        // Sort by retail value descending
        const sorted = [...items].sort((a, b) => b.retailValue - a.retailValue);
        const totalValue = sorted.reduce(
          (sum, item) => sum + item.retailValue,
          0
        );

        let cumulative = 0;
        const analysis = { A: [], B: [], C: [] };

        sorted.forEach((item) => {
          cumulative += item.retailValue;
          const percentage = (cumulative / totalValue) * 100;

          if (percentage <= 80) {
            analysis.A.push(item);
          } else if (percentage <= 95) {
            analysis.B.push(item);
          } else {
            analysis.C.push(item);
          }
        });

        return analysis;
      };

      // Placeholder methods (you can implement these)
      const calculateInventoryHealthScore = () => 80;
      const identifyInventoryOpportunities = () => [];
      const identifyInventoryRisks = () => [];
      const generateInventoryRecommendations = () => [];

      const abcAnalysis = performABCAnalysis(valuation);
      const healthScore = calculateInventoryHealthScore(
        valuation,
        inventoryCategories
      );
      const opportunities = identifyInventoryOpportunities(valuation);
      const risks = identifyInventoryRisks(valuation);

      return {
        generatedAt: new Date().toISOString(),
        summary: {
          totalProducts: valuation.length,
          totalSKUs: new Set(valuation.map((p) => p.sku).filter(Boolean)).size,
          totalStock: totalStock,
          totalCostValue: Math.round(totalCostValue * 100) / 100,
          totalRetailValue: Math.round(totalRetailValue * 100) / 100,
          totalPotentialProfit: Math.round(totalPotentialProfit * 100) / 100,
          avgProfitMargin: Math.round(avgProfitMargin * 100) / 100,
          avgMonthsOfStock: Math.round(avgMonthsOfStock * 100) / 100,
          inventoryTurnover:
            totalCostValue > 0
              ? Math.round(
                  (valuation.reduce(
                    (sum, p) => sum + p.avgMonthlySales * p.costPrice,
                    0
                  ) /
                    totalCostValue) *
                    100
                ) / 100
              : 0,
          healthScore: Math.round(healthScore * 100) / 100,
        },
        breakdown: {
          byStatus: {
            healthy: inventoryCategories.healthy.length,
            lowStock: valuation.filter((p) => p.status === "Low Stock").length,
            outOfStock: inventoryCategories.outOfStock.length,
            overstocked: inventoryCategories.overstocked.length,
            belowMinimum: valuation.filter((p) => p.status === "Below Minimum")
              .length,
          },
          byCategory: groupByCategory(valuation),
          byValueTier: {
            highValue: valuation.filter((p) => p.costValue > 1000).length,
            mediumValue: valuation.filter(
              (p) => p.costValue >= 100 && p.costValue <= 1000
            ).length,
            lowValue: valuation.filter((p) => p.costValue < 100).length,
          },
        },
        inventoryCategories,
        abcAnalysis,
        valuation: valuation.sort((a, b) => b.costValue - a.costValue),
        insights: {
          topValueItems: valuation.slice(0, 10),
          highestTurnover: valuation
            .filter((p) => p.stockTurnover > 0)
            .sort((a, b) => b.stockTurnover - a.stockTurnover)
            .slice(0, 10),
          lowestTurnover: valuation
            .filter((p) => p.stock > 0)
            .sort((a, b) => a.stockTurnover - b.stockTurnover)
            .slice(0, 10),
          deadStock: inventoryCategories.nonMoving,
          opportunities,
          risks,
        },
        recommendations: generateInventoryRecommendations(
          valuation,
          inventoryCategories,
          abcAnalysis
        ),
      };
    } catch (error) {
      console.error("❌ Inventory valuation report error:", error);
      // Return empty structure on error
      return {
        generatedAt: new Date().toISOString(),
        summary: {
          totalProducts: 0,
          totalSKUs: 0,
          totalStock: 0,
          totalCostValue: 0,
          totalRetailValue: 0,
          totalPotentialProfit: 0,
          avgProfitMargin: 0,
          avgMonthsOfStock: 0,
          inventoryTurnover: 0,
          healthScore: 0,
        },
        breakdown: {
          byStatus: {
            healthy: 0,
            lowStock: 0,
            outOfStock: 0,
            overstocked: 0,
            belowMinimum: 0,
          },
          byCategory: {},
          byValueTier: {
            highValue: 0,
            mediumValue: 0,
            lowValue: 0,
          },
        },
        inventoryCategories: {
          fastMoving: [],
          slowMoving: [],
          nonMoving: [],
          outOfStock: [],
          overstocked: [],
          healthy: [],
        },
        abcAnalysis: { A: [], B: [], C: [] },
        valuation: [],
        insights: {
          topValueItems: [],
          highestTurnover: [],
          lowestTurnover: [],
          deadStock: [],
          opportunities: [],
          risks: [],
        },
        recommendations: [],
        error: error.message,
      };
    }
  }
  // Helper: Get empty report structure
  static getEmptyReportStructure(type, errorMessage = null) {
    const baseStructure = {
      generatedAt: new Date().toISOString(),
      error: errorMessage,
      metadata: {
        isEmpty: true,
        generatedAt: new Date().toISOString(),
      },
    };

    const structures = {
      daily: {
        date: new Date().toISOString().split("T")[0],
        summary: {
          totalOrders: 0,
          completedOrders: 0,
          refundedOrders: 0,
          cancelledOrders: 0,
          grossRevenue: 0,
          totalRefunds: 0,
          netRevenue: 0,
          avgOrderValue: 0,
          totalItems: 0,
        },
        paymentInsights: {
          split: this.VALID_PAYMENT_METHODS.map((method) => ({
            method,
            count: 0,
            amount: 0,
            percentage: 0,
            amountPercentage: 0,
          })),
          topMethod: "cash",
          cashPercentage: 0,
          hasSplitPayments: false,
          validation: { totalValid: 0, hasMissingMethods: false },
        },
        channelInsights: {
          split: this.VALID_CHANNELS.map((channel) => ({
            channel,
            count: 0,
            amount: 0,
            percentage: 0,
            avgOrderValue: 0,
            validationScore: 0,
          })),
          dominantChannel: "offline",
          onlinePercentage: 0,
          validationScores: { online: 0, offline: 0 },
        },
        productInsights: {
          topProducts: [],
          totalUniqueProducts: 0,
          productSnapshots: [],
          stockValidation: [],
        },
        hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i.toString().padStart(2, "0")}:00`,
          sales: 0,
          orders: 0,
          refunds: 0,
          netSales: 0,
          dominantPaymentMethod: "cash",
          onlinePercentage: 0,
          paymentSplit: this.VALID_PAYMENT_METHODS.reduce((acc, method) => {
            acc[method] = 0;
            return acc;
          }, {}),
          channelSplit: this.VALID_CHANNELS.reduce((acc, channel) => {
            acc[channel] = 0;
            return acc;
          }, {}),
        })),
        orderBreakdown: {
          byStatus: this.VALID_ORDER_STATUSES.reduce((acc, status) => {
            acc[status] = 0;
            return acc;
          }, {}),
          byHour: Array.from({ length: 24 }, (_, i) => 0),
        },
        warnings: [],
        ...baseStructure,
      },
      payment: {
        dateRange: { start: "", end: "", days: 0, timezone: "UTC" },
        summary: {
          totalOrders: 0,
          totalRefunded: 0,
          grossRevenue: 0,
          totalRefunds: 0,
          netRevenue: 0,
          avgOrderValue: 0,
          refundRate: 0,
          daysWithSales: 0,
        },
        paymentSummary: this.VALID_PAYMENT_METHODS.reduce((acc, method) => {
          acc[method] = {
            orders: 0,
            refunds: 0,
            grossRevenue: 0,
            refundAmount: 0,
            netRevenue: 0,
            percentage: 0,
            avgOrderValue: 0,
            refundRate: 0,
          };
          return acc;
        }, {}),
        channelSummary: {
          online: {
            orders: 0,
            refunds: 0,
            grossRevenue: 0,
            refundAmount: 0,
            netRevenue: 0,
            percentage: 0,
            avgOrderValue: 0,
            refundRate: 0,
          },
          offline: {
            orders: 0,
            refunds: 0,
            grossRevenue: 0,
            refundAmount: 0,
            netRevenue: 0,
            percentage: 0,
            avgOrderValue: 0,
            refundRate: 0,
          },
        },
        dailyTrend: [],
        insights: {
          topPaymentMethod: "cash",
          topChannel: "offline",
          cashDominance: false,
          digitalAdoption: 0,
          paymentTrends: {},
          channelTrends: {},
          riskFactors: {
            highRefundRate: false,
            paymentMethodConcentration: false,
            channelImbalance: false,
          },
        },
        recommendations: [],
        ...baseStructure,
      },
      // Add similar empty structures for other report types
      channel: {
        generatedAt: new Date().toISOString(),
        dateRange: { start: "", end: "", days: 0 },
        summary: {},
        channelDetails: {},
        customerInsights: null,
        insights: {},
        recommendations: [],
        ...baseStructure,
      },
      trend: {
        period: "weekly",
        dateRange: { start: "", end: "", periods: 0 },
        summary: {},
        trend: [],
        growthMetrics: {},
        patterns: {},
        insights: {},
        metadata: {},
        ...baseStructure,
      },
      inventory: {
        generatedAt: new Date().toISOString(),
        summary: {},
        breakdown: {},
        inventoryCategories: {},
        abcAnalysis: {},
        valuation: [],
        insights: {},
        recommendations: [],
        ...baseStructure,
      },
    };

    return structures[type] || baseStructure;
  }

  // Helper: Get week number
  static getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
  }

  // Helper: Calculate payment trends
  static calculatePaymentTrends(dailyTrend) {
    if (dailyTrend.length < 2) return {};

    const trends = {};
    this.VALID_PAYMENT_METHODS.forEach((method) => {
      const methodData = dailyTrend.map(
        (day) =>
          day.paymentSplit.find((p) => p.method === method)?.percentage || 0
      );

      if (methodData.length > 1) {
        const first = methodData[0];
        const last = methodData[methodData.length - 1];
        const trend = last - first;
        const isIncreasing = trend > 1;
        const isDecreasing = trend < -1;
        const isStable = Math.abs(trend) <= 1;

        trends[method] = {
          trend,
          direction: isIncreasing
            ? "increasing"
            : isDecreasing
            ? "decreasing"
            : "stable",
          volatility: this.calculateVolatility(methodData),
          consistency: this.calculateConsistency(methodData),
        };
      }
    });

    return trends;
  }

  // Helper: Calculate channel trends
  static calculateChannelTrends(dailyTrend) {
    if (dailyTrend.length < 2) return {};

    const onlineData = dailyTrend.map(
      (day) =>
        day.channelSplit.find((c) => c.channel === "online")?.percentage || 0
    );
    const offlineData = dailyTrend.map(
      (day) =>
        day.channelSplit.find((c) => c.channel === "offline")?.percentage || 0
    );

    const onlineTrend = onlineData[onlineData.length - 1] - onlineData[0];
    const offlineTrend = offlineData[offlineData.length - 1] - offlineData[0];

    return {
      online: {
        trend: onlineTrend,
        direction:
          onlineTrend > 1
            ? "increasing"
            : onlineTrend < -1
            ? "decreasing"
            : "stable",
        avgPercentage:
          onlineData.reduce((a, b) => a + b, 0) / onlineData.length,
        peak: Math.max(...onlineData),
        low: Math.min(...onlineData),
      },
      offline: {
        trend: offlineTrend,
        direction:
          offlineTrend > 1
            ? "increasing"
            : offlineTrend < -1
            ? "decreasing"
            : "stable",
        avgPercentage:
          offlineData.reduce((a, b) => a + b, 0) / offlineData.length,
        peak: Math.max(...offlineData),
        low: Math.min(...offlineData),
      },
    };
  }

  // Helper: Generate payment recommendations
  static generatePaymentRecommendations(paymentSummary, channelSummary) {
    const recommendations = [];

    // Cash dominance
    if (paymentSummary.cash?.percentage > 70) {
      recommendations.push({
        type: "payment_diversification",
        priority: "high",
        action: "Launch digital payment promotion with 5-10% cashback",
        expectedImpact: "Reduce cash dependency by 15-20%",
        timeline: "immediate",
      });
    }

    // Low digital adoption
    const digitalPercentage =
      (paymentSummary.upi?.percentage || 0) +
      (paymentSummary.card?.percentage || 0) +
      (paymentSummary.qr?.percentage || 0) +
      (paymentSummary.wallet?.percentage || 0);

    if (digitalPercentage < 30) {
      recommendations.push({
        type: "digital_adoption",
        priority: "medium",
        action:
          "Implement QR code displays and digital payment training for staff",
        expectedImpact: "Increase digital payments by 25%",
        timeline: "30 days",
      });
    }

    // High refund rate
    const highRefundMethods = Object.entries(paymentSummary)
      .filter(([_, data]) => data.refundRate > 5)
      .map(([method]) => method);

    if (highRefundMethods.length > 0) {
      recommendations.push({
        type: "risk_mitigation",
        priority: "high",
        action: `Review refund process for ${highRefundMethods.join(
          ", "
        )} payments`,
        expectedImpact: "Reduce refund rate by 30%",
        timeline: "immediate",
      });
    }

    // Channel-specific recommendations
    if (
      channelSummary.online.refundRate >
      channelSummary.offline.refundRate * 1.5
    ) {
      recommendations.push({
        type: "channel_optimization",
        priority: "medium",
        action: "Improve online product descriptions and images",
        expectedImpact: "Reduce online refunds by 20%",
        timeline: "14 days",
      });
    }

    return recommendations;
  }

  // Helper: Calculate average days between orders
  static calculateAverageDaysBetweenOrders(orderDates) {
    if (orderDates.length < 2) return 0;

    const sortedDates = orderDates.sort((a, b) => a - b);
    const gaps = [];

    for (let i = 1; i < sortedDates.length; i++) {
      const gap = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }

    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  }

  // Helper: Calculate monthly spending
  static calculateMonthlySpending(orders) {
    const monthlyData = {};

    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          orders: 0,
          revenue: 0,
          items: 0,
        };
      }

      monthlyData[monthKey].orders += 1;
      monthlyData[monthKey].revenue += order.total || 0;
      monthlyData[monthKey].items += order.items.reduce(
        (sum, item) => sum + (item.qty || 0),
        0
      );
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        orders: data.orders,
        revenue: Math.round(data.revenue * 100) / 100,
        avgOrderValue: Math.round((data.revenue / data.orders) * 100) / 100,
        items: data.items,
        avgItemsPerOrder: Math.round((data.items / data.orders) * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // Helper: Analyze seasonal pattern
  static analyzeSeasonalPattern(orders) {
    if (orders.length < 10)
      return { hasPattern: false, message: "Insufficient data" };

    const monthlyRevenue = {};
    const dayOfWeekRevenue = {};
    const hourOfDayRevenue = Array(24).fill(0);

    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      const month = date.getMonth();
      const dayOfWeek = date.getDay();
      const hour = date.getHours();

      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (order.total || 0);
      dayOfWeekRevenue[dayOfWeek] =
        (dayOfWeekRevenue[dayOfWeek] || 0) + (order.total || 0);
      hourOfDayRevenue[hour] += order.total || 0;
    });

    // Find peaks
    const peakMonth = Object.entries(monthlyRevenue).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const peakDay = Object.entries(dayOfWeekRevenue).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const peakHour = hourOfDayRevenue.indexOf(Math.max(...hourOfDayRevenue));

    return {
      hasPattern: true,
      peakMonth: {
        month: peakMonth
          ? [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ][parseInt(peakMonth[0])]
          : "N/A",
        revenue: peakMonth ? Math.round(peakMonth[1] * 100) / 100 : 0,
        percentage:
          Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) > 0
            ? Math.round(
                (peakMonth[1] /
                  Object.values(monthlyRevenue).reduce((a, b) => a + b, 0)) *
                  10000
              ) / 100
            : 0,
      },
      peakDay: {
        day: peakDay
          ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              parseInt(peakDay[0])
            ]
          : "N/A",
        revenue: peakDay ? Math.round(peakDay[1] * 100) / 100 : 0,
      },
      peakHour: {
        hour: `${peakHour.toString().padStart(2, "0")}:00`,
        revenue: Math.round(hourOfDayRevenue[peakHour] * 100) / 100,
      },
      monthlyDistribution: Object.entries(monthlyRevenue).map(
        ([month, revenue]) => ({
          month: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ][parseInt(month)],
          revenue: Math.round(revenue * 100) / 100,
          percentage:
            Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) > 0
              ? Math.round(
                  (revenue /
                    Object.values(monthlyRevenue).reduce((a, b) => a + b, 0)) *
                    10000
                ) / 100
              : 0,
        })
      ),
      seasonalityScore: this.calculateSeasonalityScore(monthlyRevenue),
    };
  }

  // Helper: Calculate seasonality score
  static calculateSeasonalityScore(monthlyRevenue) {
    const values = Object.values(monthlyRevenue);
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Normalize to 0-100 scale
    const cv = (stdDev / mean) * 100;
    return Math.min(100, Math.round(cv * 10) / 10);
  }

  // Helper: Calculate monetary score (RFM analysis)
  static calculateMonetaryScore(totalSpent, avgOrderValue) {
    if (totalSpent > 10000) return 5;
    if (totalSpent > 5000) return 4;
    if (totalSpent > 2000) return 3;
    if (totalSpent > 500) return 2;
    return 1;
  }

  // Helper: Calculate frequency score
  static calculateFrequencyScore(orderCount, daysAsCustomer) {
    const ordersPerMonth = orderCount / Math.max(1, daysAsCustomer / 30);

    if (ordersPerMonth > 4) return 5;
    if (ordersPerMonth > 2) return 4;
    if (ordersPerMonth > 1) return 3;
    if (ordersPerMonth > 0.5) return 2;
    return 1;
  }

  // Helper: Calculate recency score
  static calculateRecencyScore(lastOrder) {
    if (!lastOrder) return 1;

    const daysSinceLastOrder = Math.ceil(
      (new Date() - lastOrder) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastOrder <= 7) return 5;
    if (daysSinceLastOrder <= 30) return 4;
    if (daysSinceLastOrder <= 90) return 3;
    if (daysSinceLastOrder <= 180) return 2;
    return 1;
  }

  // Helper: Segment customer based on RFM
  static segmentCustomer(customerValue) {
    const { recencyScore, frequencyScore, monetaryScore } = customerValue;
    const totalScore = recencyScore + frequencyScore + monetaryScore;

    if (totalScore >= 14) return "champion";
    if (totalScore >= 11) return "loyal";
    if (totalScore >= 8) return "potential";
    if (totalScore >= 5) return "new";
    if (totalScore >= 3) return "at_risk";
    return "lost";
  }

  // Helper: Predict next purchase
  static predictNextPurchase(orderDates) {
    if (orderDates.length < 3) return null;

    const sortedDates = orderDates.sort((a, b) => a - b);
    const gaps = [];

    for (let i = 1; i < sortedDates.length; i++) {
      const gap = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }

    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const lastOrder = sortedDates[sortedDates.length - 1];
    const predictedDate = new Date(
      lastOrder.getTime() + avgGap * 24 * 60 * 60 * 1000
    );

    return {
      predictedDate: predictedDate.toISOString().split("T")[0],
      confidence: Math.round((1 - this.calculateStdDev(gaps) / avgGap) * 100),
      avgDaysBetween: Math.round(avgGap * 100) / 100,
    };
  }

  // Helper: Calculate churn risk
  static calculateChurnRisk(customerValue) {
    const { recencyScore, frequencyScore, segment } = customerValue;

    let risk = 0;

    // Recency based risk
    if (recencyScore === 1) risk += 40;
    else if (recencyScore === 2) risk += 20;
    else if (recencyScore === 3) risk += 10;

    // Frequency based risk
    if (frequencyScore === 1) risk += 30;
    else if (frequencyScore === 2) risk += 15;

    // Segment based risk
    if (segment === "at_risk") risk += 20;
    if (segment === "lost") risk += 30;

    return Math.min(100, risk);
  }

  // Helper: Calculate loyalty score
  static calculateLoyaltyScore(customerValue, refundCount) {
    const { recencyScore, frequencyScore, monetaryScore, segment } =
      customerValue;
    const baseScore = (recencyScore + frequencyScore + monetaryScore) * 10;

    let loyaltyScore = baseScore;

    // Adjust for refunds
    if (refundCount > 0) {
      loyaltyScore -= refundCount * 5;
    }

    // Adjust for segment
    if (segment === "champion") loyaltyScore += 20;
    if (segment === "loyal") loyaltyScore += 10;
    if (segment === "at_risk") loyaltyScore -= 15;
    if (segment === "lost") loyaltyScore -= 30;

    return Math.max(0, Math.min(100, loyaltyScore));
  }

  // Helper: Calculate potential value
  static calculatePotentialValue(customerValue, segment) {
    const { lifetimeValue, avgOrderValue, orderFrequency } = customerValue;

    let multiplier = 1;
    if (segment === "champion") multiplier = 1.5;
    if (segment === "loyal") multiplier = 1.2;
    if (segment === "potential") multiplier = 2.0;
    if (segment === "new") multiplier = 3.0;

    const monthlyValue = avgOrderValue * orderFrequency;
    const annualPotential = monthlyValue * 12 * multiplier;

    return {
      monthly: Math.round(monthlyValue * 100) / 100,
      annual: Math.round(annualPotential * 100) / 100,
      lifetime: Math.round(lifetimeValue * 100) / 100,
      growthPotential:
        Math.round((annualPotential - lifetimeValue) * 100) / 100,
    };
  }

  // Helper: Identify customer opportunities
  static identifyCustomerOpportunities(
    customerValue,
    favoriteProducts,
    favoriteCategories
  ) {
    const opportunities = [];
    const { segment, avgOrderValue, orderFrequency } = customerValue;

    // Upselling opportunities
    if (avgOrderValue < 50 && segment !== "lost") {
      opportunities.push({
        type: "upsell",
        action: "Recommend premium products or bundles",
        potentialValue: `Increase AOV by ${
          Math.round((50 - avgOrderValue) * 100) / 100
        }`,
        priority: "medium",
      });
    }

    // Cross-selling opportunities
    if (favoriteProducts.length > 0 && favoriteCategories.length > 0) {
      opportunities.push({
        type: "cross_sell",
        action: `Recommend complementary products to ${favoriteProducts[0].name}`,
        potentialValue: "Increase basket size by 15-20%",
        priority: "low",
      });
    }

    // Frequency opportunities
    if (orderFrequency < 1 && segment !== "lost") {
      opportunities.push({
        type: "frequency",
        action: "Implement loyalty program or subscription",
        potentialValue: "Increase purchase frequency by 30%",
        priority: "high",
      });
    }

    return opportunities;
  }

  // Helper: Calculate retention rate
  static calculateRetentionRate(onlineOrders) {
    if (onlineOrders.length < 10) return 0;

    const customers = new Set(onlineOrders.map((o) => o.customerId));
    const repeatCustomers = onlineOrders.length - customers.size;

    return onlineOrders.length > 0
      ? (repeatCustomers / onlineOrders.length) * 100
      : 0;
  }

  // Helper: Calculate lifetime value
  static calculateLifetimeValue(onlineOrders) {
    if (onlineOrders.length === 0) return 0;

    const customerRevenue = {};

    onlineOrders.forEach((order) => {
      if (order.customerId && this.COMPLETED_STATUSES.includes(order.status)) {
        customerRevenue[order.customerId] =
          (customerRevenue[order.customerId] || 0) + (order.total || 0);
      }
    });

    const revenues = Object.values(customerRevenue);
    return revenues.length > 0
      ? revenues.reduce((a, b) => a + b, 0) / revenues.length
      : 0;
  }

  // Helper: Calculate std deviation
  static calculateStdDev(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const variance =
      numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  // Helper: Calculate volatility
  static calculateVolatility(numbers) {
    if (numbers.length < 2) return 0;
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const variance =
      numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
    return (Math.sqrt(variance) / mean) * 100;
  }

  // Helper: Calculate consistency
  static calculateConsistency(numbers) {
    if (numbers.length < 2) return 100;
    const volatility = this.calculateVolatility(numbers);
    return Math.max(0, 100 - volatility);
  }

  // Helper: Group by category
  static groupByCategory(items) {
    return items.reduce((groups, item) => {
      const category = item.category || "Uncategorized";
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  }

  // Helper: Calculate segment distribution
  static calculateSegmentDistribution(customerReports) {
    const segments = customerReports.reduce((acc, customer) => {
      const segment = customer.valueMetrics.segment || "unknown";
      acc[segment] = (acc[segment] || 0) + 1;
      return acc;
    }, {});

    const total = customerReports.length;
    return Object.entries(segments).map(([segment, count]) => ({
      segment,
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }));
  }

  // Helper: Analyze shopping hours
  static analyzeShoppingHours(orders) {
    const hourCounts = Array(24).fill(0);

    orders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      hourCounts[hour] += 1;
    });

    const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
    return {
      peakHour: `${peakHourIndex.toString().padStart(2, "0")}:00`,
      distribution: hourCounts.map((count, hour) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        orders: count,
        percentage:
          orders.length > 0
            ? Math.round((count / orders.length) * 10000) / 100
            : 0,
      })),
    };
  }

  // Helper: Analyze shopping days
  static analyzeShoppingDays(orders) {
    const dayCounts = Array(7).fill(0);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    orders.forEach((order) => {
      const day = new Date(order.createdAt).getDay();
      dayCounts[day] += 1;
    });

    const peakDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
    return {
      peakDay: dayNames[peakDayIndex],
      distribution: dayCounts.map((count, day) => ({
        day: dayNames[day],
        orders: count,
        percentage:
          orders.length > 0
            ? Math.round((count / orders.length) * 10000) / 100
            : 0,
      })),
    };
  }

  // Note: The following methods would be implemented similarly:
  // - analyzeSupplierPerformance
  // - calculateRestockPriority
  // - generateStockRecommendations
  // - identifyChannelStrengths/Weaknesses/Opportunities/Threats
  // - findSynergyOpportunities
  // - generateChannelRecommendations
  // - calculateGrowthMetrics
  // - identifyTrendPatterns
  // - calculateConsistencyScore
  // - analyzeSeasonality
  // - generateForecast
  // - generateTrendRecommendations
  // - performABCAnalysis
  // - calculateInventoryHealthScore
  // - identifyInventoryOpportunities/Risks
  // - generateInventoryRecommendations

  // Due to length constraints, these would be implemented in a similar pattern to the above helpers
  // Each would contain business logic specific to your requirements

  // Placeholder implementations for missing methods
  static analyzeSupplierPerformance(products) {
    // Implementation for supplier performance analysis
    return [];
  }

  static calculateRestockPriority(products) {
    // Implementation for restock priority calculation
    return [];
  }

  static generateStockRecommendations(products) {
    // Implementation for stock recommendations
    return [];
  }

  static identifyChannelStrengths(onlineMetrics, offlineMetrics) {
    // Implementation for channel strengths identification
    return [];
  }

  static identifyChannelWeaknesses(onlineMetrics, offlineMetrics) {
    // Implementation for channel weaknesses identification
    return [];
  }

  static identifyChannelOpportunities(onlineMetrics, offlineMetrics) {
    // Implementation for channel opportunities identification
    return [];
  }

  static identifyChannelThreats(onlineMetrics, offlineMetrics) {
    // Implementation for channel threats identification
    return [];
  }

  static findSynergyOpportunities(onlineMetrics, offlineMetrics) {
    // Implementation for synergy opportunities identification
    return [];
  }

  static generateChannelRecommendations(
    onlineMetrics,
    offlineMetrics,
    growthData
  ) {
    // Implementation for channel recommendations
    return [];
  }

  static calculateGrowthMetrics(trend) {
    // Implementation for growth metrics calculation
    return {};
  }

  static identifyTrendPatterns(trend) {
    // Implementation for trend pattern identification
    return {};
  }

  static calculateConsistencyScore(trend) {
    // Implementation for consistency score calculation
    return 0;
  }

  static analyzeSeasonality(trend, period) {
    // Implementation for seasonality analysis
    return {};
  }

  static generateForecast(trend, period) {
    // Implementation for forecast generation
    return {};
  }

  static generateTrendRecommendations(trend, patterns, growthMetrics) {
    // Implementation for trend recommendations
    return [];
  }

  static performABCAnalysis(valuation) {
    // Implementation for ABC analysis
    return { A: [], B: [], C: [] };
  }

  static calculateInventoryHealthScore(valuation, inventoryCategories) {
    // Implementation for inventory health score calculation
    return 0;
  }

  static identifyInventoryOpportunities(valuation) {
    // Implementation for inventory opportunities identification
    return [];
  }

  static identifyInventoryRisks(valuation) {
    // Implementation for inventory risks identification
    return [];
  }

  static generateInventoryRecommendations(
    valuation,
    inventoryCategories,
    abcAnalysis
  ) {
    // Implementation for inventory recommendations
    return [];
  }

  static identifyCustomerRisks(customerValue, refundCount, churnRisk) {
    // Implementation for customer risks identification
    return [];
  }

  static generateCustomerRecommendations(segment, customerValue, behavior) {
    // Implementation for customer recommendations
    return [];
  }

  // Original methods from the provided file (maintained for compatibility)
  static calculateGrowthRate(data) {
    if (data.length < 2) return 0;
    const first = data[0] || 1;
    const last = data[data.length - 1] || 1;
    return Math.round(((last - first) / first) * 10000) / 100;
  }

  static calculateStability(percentages) {
    if (percentages.length < 2) return 100;
    const mean = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const variance =
      percentages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      percentages.length;
    const stdDev = Math.sqrt(variance);
    const stability = Math.max(0, 100 - stdDev * 10);
    return Math.round(stability * 100) / 100;
  }

  static generateChannelInsights(online, offline) {
    const insights = [];

    if (online.metrics.avgOrderValue > offline.metrics.avgOrderValue * 1.2) {
      insights.push(
        "Online channel has significantly higher average order value. Consider promoting online ordering to offline customers."
      );
    }

    if (offline.metrics.orderCount > online.metrics.orderCount * 2) {
      insights.push(
        "Offline channel dominates order volume. Consider implementing loyalty programs to encourage repeat offline purchases."
      );
    }

    if (online.metrics.peakHour !== offline.metrics.peakHour) {
      insights.push(
        `Peak hours differ: Online peaks at ${online.metrics.peakHour}, Offline at ${offline.metrics.peakHour}. Consider targeted promotions during these times.`
      );
    }

    if (
      online.metrics.topProducts.length > 0 &&
      offline.metrics.topProducts.length > 0
    ) {
      const onlineTop = online.metrics.topProducts[0]?.name;
      const offlineTop = offline.metrics.topProducts[0]?.name;

      if (onlineTop !== offlineTop) {
        insights.push(
          `Top products differ between channels. Cross-promote ${onlineTop} to offline customers and ${offlineTop} to online customers.`
        );
      }
    }

    return insights;
  }

  static identifyChannelOpportunities(online, offline) {
    const opportunities = [];

    // Check for time-based opportunities
    const onlinePeak = parseInt(online.metrics.peakHour.split(":")[0]);
    const offlinePeak = parseInt(offline.metrics.peakHour.split(":")[0]);

    if (Math.abs(onlinePeak - offlinePeak) >= 3) {
      opportunities.push({
        type: "time-based",
        description: `Schedule promotions during ${onlinePeak}:00-${offlinePeak}:00 to bridge the gap between channel peaks`,
        potentialImpact: "medium",
      });
    }

    // Check for product-based opportunities
    const onlineProducts = new Set(online.topProducts.map((p) => p.name));
    const offlineProducts = new Set(offline.topProducts.map((p) => p.name));
    const uniqueOnlineProducts = [...onlineProducts].filter(
      (p) => !offlineProducts.has(p)
    );
    const uniqueOfflineProducts = [...offlineProducts].filter(
      (p) => !onlineProducts.has(p)
    );

    if (uniqueOnlineProducts.length > 0) {
      opportunities.push({
        type: "product-based",
        description: `Promote online-exclusive products (${uniqueOnlineProducts
          .slice(0, 2)
          .join(", ")}) in offline stores`,
        potentialImpact: "high",
      });
    }

    if (uniqueOfflineProducts.length > 0) {
      opportunities.push({
        type: "product-based",
        description: `Feature offline best-sellers (${uniqueOfflineProducts
          .slice(0, 2)
          .join(", ")}) prominently online`,
        potentialImpact: "high",
      });
    }

    // Check for value-based opportunities
    if (online.metrics.avgOrderValue > offline.metrics.avgOrderValue * 1.3) {
      opportunities.push({
        type: "value-based",
        description:
          "Introduce bundle deals or minimum order incentives for offline channel",
        potentialImpact: "medium",
      });
    }

    return opportunities;
  }
}
