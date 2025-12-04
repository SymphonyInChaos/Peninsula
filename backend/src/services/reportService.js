// services/reportService.js
import prisma from "../utils/db.js";

export class ReportService {
  // DAILY SALES REPORT
  static async getDailySalesReport(date = null) {
    try {
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const dailyOrders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          customer: {
            select: { name: true, id: true },
          },
          items: {
            include: {
              product: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate metrics
      const totalSales = dailyOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );
      const orderCount = dailyOrders.length;
      const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

      // Top selling products for the day
      const productSales = {};
      dailyOrders.forEach((order) => {
        order.items.forEach((item) => {
          const productName = item.product.name;
          productSales[productName] =
            (productSales[productName] || 0) + (item.qty || 0);
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([name, qty]) => ({ name, quantity: qty }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      return {
        date: startOfDay.toISOString().split("T")[0],
        summary: {
          totalSales: Math.round(totalSales * 100) / 100,
          orderCount,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          totalItems: dailyOrders.reduce(
            (sum, order) =>
              sum +
              order.items.reduce(
                (itemSum, item) => itemSum + (item.qty || 0),
                0
              ),
            0
          ),
        },
        orders: dailyOrders.map((order) => ({
          id: order.id,
          customer: order.customer?.name || "Walk-in",
          total: order.total || 0,
          itemCount: order.items.length,
          time: order.createdAt.toISOString(),
        })),
        topProducts,
        hourlyBreakdown: await this.getHourlySales(startOfDay, endOfDay),
      };
    } catch (error) {
      console.error("Daily sales report error:", error);
      // Return empty data structure instead of throwing
      return {
        date: new Date().toISOString().split("T")[0],
        summary: {
          totalSales: 0,
          orderCount: 0,
          avgOrderValue: 0,
          totalItems: 0,
        },
        orders: [],
        topProducts: [],
        hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i.toString().padStart(2, "0")}:00`,
          sales: 0,
          orders: 0,
        })),
      };
    }
  }

  // HOURLY SALES BREAKDOWN
  static async getHourlySales(startOfDay, endOfDay) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        select: {
          createdAt: true,
          total: true,
        },
      });

      // Group by hour
      const hourlySales = {};
      orders.forEach((order) => {
        const hour = new Date(order.createdAt).getHours();
        hourlySales[hour] = hourlySales[hour] || { sales: 0, orders: 0 };
        hourlySales[hour].sales += order.total || 0;
        hourlySales[hour].orders += 1;
      });

      // Fill missing hours
      const result = [];
      for (let hour = 0; hour < 24; hour++) {
        result.push({
          hour: `${hour.toString().padStart(2, "0")}:00`,
          sales: hourlySales[hour]?.sales || 0,
          orders: hourlySales[hour]?.orders || 0,
        });
      }

      return result;
    } catch (error) {
      console.error("Hourly sales error:", error);
      // Return empty hourly data
      return Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        sales: 0,
        orders: 0,
      }));
    }
  }

  // LOW STOCK REPORT
  static async getLowStockReport(threshold = 10) {
    try {
      const lowStockProducts = await prisma.product.findMany({
        where: {
          stock: {
            lte: threshold,
          },
        },
        orderBy: [{ stock: "asc" }, { name: "asc" }],
      });

      // Calculate reorder suggestions
      const productsWithSuggestions = lowStockProducts.map((product) => {
        let reorderSuggestion = "";
        let urgency = "low";

        if (product.stock === 0) {
          reorderSuggestion = "URGENT: Out of stock. Reorder immediately.";
          urgency = "high";
        } else if (product.stock <= 3) {
          reorderSuggestion = `High priority: Only ${product.stock} left. Reorder soon.`;
          urgency = "high";
        } else if (product.stock <= 10) {
          reorderSuggestion = `Medium priority: ${product.stock} in stock. Consider reordering.`;
          urgency = "medium";
        } else {
          reorderSuggestion = `Low priority: ${product.stock} in stock. Monitor closely.`;
          urgency = "low";
        }

        return {
          ...product,
          reorderSuggestion,
          urgency,
          suggestedReorderQty: Math.max(25, product.stock * 3), // Simple reorder formula
        };
      });

      return {
        generatedAt: new Date().toISOString(),
        threshold,
        summary: {
          totalLowStock: lowStockProducts.length,
          outOfStock: lowStockProducts.filter((p) => p.stock === 0).length,
          criticalStock: lowStockProducts.filter((p) => p.stock <= 3).length,
          warningStock: lowStockProducts.filter(
            (p) => p.stock > 3 && p.stock <= 10
          ).length,
        },
        products: productsWithSuggestions,
      };
    } catch (error) {
      console.error("Low stock report error:", error);
      return {
        generatedAt: new Date().toISOString(),
        threshold,
        summary: {
          totalLowStock: 0,
          outOfStock: 0,
          criticalStock: 0,
          warningStock: 0,
        },
        products: [],
      };
    }
  }

  // CUSTOMER PURCHASE HISTORY
  static async getCustomerPurchaseHistory(customerId = null, limit = 50) {
    try {
      let customers;

      if (customerId) {
        // Single customer detail
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          include: {
            orders: {
              include: {
                items: {
                  include: {
                    product: {
                      select: { name: true, price: true },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (!customer) {
          throw new Error("Customer not found");
        }

        customers = [customer];
      } else {
        // All customers with their orders
        customers = await prisma.customer.findMany({
          include: {
            orders: {
              include: {
                items: {
                  include: {
                    product: {
                      select: { name: true },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { name: "asc" },
        });
      }

      const customerReports = customers.map((customer) => {
        const totalSpent = customer.orders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );
        const orderCount = customer.orders.length;
        const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

        // Calculate favorite products
        const productFrequency = {};
        customer.orders.forEach((order) => {
          order.items.forEach((item) => {
            const productName = item.product.name;
            productFrequency[productName] =
              (productFrequency[productName] || 0) + (item.qty || 0);
          });
        });

        const favoriteProducts = Object.entries(productFrequency)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        // Recent activity
        const lastOrder = customer.orders[0];
        const recentActivity = customer.orders.slice(0, 5).map((order) => ({
          id: order.id,
          date: order.createdAt.toISOString().split("T")[0],
          total: order.total || 0,
          items: order.items.length,
        }));

        return {
          customerId: customer.id,
          customerName: customer.name,
          contact: {
            email: customer.email,
            phone: customer.phone,
          },
          summary: {
            totalSpent: Math.round(totalSpent * 100) / 100,
            orderCount,
            avgOrderValue: Math.round(avgOrderValue * 100) / 100,
            firstOrder:
              customer.orders.length > 0
                ? customer.orders[customer.orders.length - 1].createdAt
                    .toISOString()
                    .split("T")[0]
                : "No orders",
            lastOrder: lastOrder
              ? lastOrder.createdAt.toISOString().split("T")[0]
              : "No orders",
          },
          favoriteProducts,
          recentActivity,
          allOrders: customer.orders.map((order) => ({
            id: order.id,
            date: order.createdAt.toISOString(),
            total: order.total || 0,
            items: order.items.map((item) => ({
              product: item.product.name,
              quantity: item.qty || 0,
              price: item.price || 0,
            })),
          })),
        };
      });

      return {
        generatedAt: new Date().toISOString(),
        [customerId ? "customer" : "customers"]: customerId
          ? customerReports[0]
          : customerReports.slice(0, limit),
      };
    } catch (error) {
      console.error("Customer history report error:", error);
      return {
        generatedAt: new Date().toISOString(),
        customers: [],
      };
    }
  }

  // SALES TREND REPORT (Weekly/Monthly)
  static async getSalesTrendReport(period = "weekly", weeks = 8) {
    try {
      const endDate = new Date();
      const startDate = new Date();

      if (period === "weekly") {
        startDate.setDate(endDate.getDate() - weeks * 7);
      } else {
        startDate.setMonth(endDate.getMonth() - weeks);
      }

      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, id: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by time period
      const salesData = {};
      orders.forEach((order) => {
        const dateKey =
          period === "weekly"
            ? this.getWeekNumber(order.createdAt)
            : order.createdAt.toISOString().slice(0, 7); // YYYY-MM

        if (!salesData[dateKey]) {
          salesData[dateKey] = {
            period: dateKey,
            totalSales: 0,
            orderCount: 0,
            products: {},
          };
        }

        salesData[dateKey].totalSales += order.total || 0;
        salesData[dateKey].orderCount += 1;

        // Track product sales
        order.items.forEach((item) => {
          const productId = item.product.id;
          if (!salesData[dateKey].products[productId]) {
            salesData[dateKey].products[productId] = {
              name: item.product.name,
              quantity: 0,
              revenue: 0,
            };
          }
          salesData[dateKey].products[productId].quantity += item.qty || 0;
          salesData[dateKey].products[productId].revenue +=
            (item.price || 0) * (item.qty || 0);
        });
      });

      const trend = Object.values(salesData).map((periodData) => ({
        ...periodData,
        avgOrderValue:
          periodData.orderCount > 0
            ? periodData.totalSales / periodData.orderCount
            : 0,
        topProducts: Object.values(periodData.products)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3),
      }));

      return {
        period,
        dateRange: {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        },
        trend,
        summary: {
          totalRevenue: trend.reduce(
            (sum, period) => sum + (period.totalSales || 0),
            0
          ),
          totalOrders: trend.reduce(
            (sum, period) => sum + (period.orderCount || 0),
            0
          ),
          avgWeeklyRevenue:
            period === "weekly"
              ? trend.reduce(
                  (sum, period) => sum + (period.totalSales || 0),
                  0
                ) / (trend.length || 1)
              : null,
        },
      };
    } catch (error) {
      console.error("Sales trend report error:", error);
      return {
        period,
        dateRange: { start: "", end: "" },
        trend: [],
        summary: { totalRevenue: 0, totalOrders: 0, avgWeeklyRevenue: 0 },
      };
    }
  }

  // INVENTORY VALUATION REPORT
  static async getInventoryValuationReport() {
    try {
      const products = await prisma.product.findMany({
        orderBy: { name: "asc" },
      });

      const valuation = products.map((product) => ({
        ...product,
        value: (product.price || 0) * (product.stock || 0),
        status:
          product.stock === 0
            ? "Out of Stock"
            : product.stock <= 5
            ? "Low"
            : product.stock <= 20
            ? "Medium"
            : "Good",
      }));

      const totalValue = valuation.reduce(
        (sum, product) => sum + (product.value || 0),
        0
      );
      const stockCount = valuation.reduce(
        (sum, product) => sum + (product.stock || 0),
        0
      );

      return {
        generatedAt: new Date().toISOString(),
        summary: {
          totalProducts: products.length,
          totalInventoryValue: Math.round(totalValue * 100) / 100,
          totalStockCount: stockCount,
          averageProductValue:
            products.length > 0
              ? Math.round((totalValue / products.length) * 100) / 100
              : 0,
        },
        breakdown: {
          outOfStock: valuation.filter((p) => p.stock === 0).length,
          lowStock: valuation.filter((p) => p.stock <= 5).length,
          healthyStock: valuation.filter((p) => p.stock > 5).length,
        },
        products: valuation.sort((a, b) => (b.value || 0) - (a.value || 0)), // Sort by highest value first
      };
    } catch (error) {
      console.error("Inventory valuation report error:", error);
      return {
        generatedAt: new Date().toISOString(),
        summary: {
          totalProducts: 0,
          totalInventoryValue: 0,
          totalStockCount: 0,
          averageProductValue: 0,
        },
        breakdown: { outOfStock: 0, lowStock: 0, healthyStock: 0 },
        products: [],
      };
    }
  }

  // HELPER: Get week number
  static getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
  }
}
