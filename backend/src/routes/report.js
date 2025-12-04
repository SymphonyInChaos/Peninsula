// routes/reports.js
import { Router } from "express";
import { ReportService } from "../services/reportService.js";
import { authenticate } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

// All reports require authentication
router.use(authenticate);

// DAILY SALES REPORT
router.get("/sales/daily", async (req, res, next) => {
  try {
    const { date } = req.query; // Optional: YYYY-MM-DD format

    const report = await ReportService.getDailySalesReport(date);

    res.json({
      success: true,
      message: "Daily sales report generated successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// LOW STOCK REPORT
router.get("/inventory/low-stock", async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const report = await ReportService.getLowStockReport(threshold);

    res.json({
      success: true,
      message: "Low stock report generated successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// CUSTOMER PURCHASE HISTORY
router.get("/customers/history", async (req, res, next) => {
  try {
    const { customerId, limit = 50 } = req.query;

    const report = await ReportService.getCustomerPurchaseHistory(
      customerId,
      parseInt(limit)
    );

    res.json({
      success: true,
      message: "Customer purchase history generated successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// SALES TREND REPORT
router.get("/sales/trend", async (req, res, next) => {
  try {
    const { period = "weekly", weeks = 8 } = req.query;

    const report = await ReportService.getSalesTrendReport(
      period,
      parseInt(weeks)
    );

    res.json({
      success: true,
      message: "Sales trend report generated successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// INVENTORY VALUATION REPORT
router.get("/inventory/valuation", async (req, res, next) => {
  try {
    const report = await ReportService.getInventoryValuationReport();

    res.json({
      success: true,
      message: "Inventory valuation report generated successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// COMPREHENSIVE DASHBOARD SUMMARY
router.get("/dashboard", async (req, res, next) => {
  try {
    const [dailySales, lowStock, inventoryValue] = await Promise.all([
      ReportService.getDailySalesReport(),
      ReportService.getLowStockReport(10),
      ReportService.getInventoryValuationReport(),
    ]);

    const dashboard = {
      overview: {
        today: {
          revenue: dailySales.summary.totalSales || 0,
          orders: dailySales.summary.orderCount || 0,
          avgOrder: dailySales.summary.avgOrderValue || 0,
        },
        inventory: {
          totalValue: inventoryValue.summary.totalInventoryValue || 0,
          lowStockItems: lowStock.summary.totalLowStock || 0,
          outOfStock: lowStock.summary.outOfStock || 0,
        },
      },
      alerts: {
        critical: (lowStock.products || [])
          .filter((p) => p.urgency === "high")
          .slice(0, 5),
        todayPerformance:
          (dailySales.summary.totalSales || 0) > 1000
            ? "good"
            : (dailySales.summary.totalSales || 0) > 500
            ? "average"
            : "needs_attention",
      },
      quickStats: {
        hourlySales: dailySales.hourlyBreakdown || [],
        topProducts: dailySales.topProducts || [],
      },
    };

    res.json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: dashboard,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    // Return empty dashboard on error
    const emptyDashboard = {
      overview: {
        today: { revenue: 0, orders: 0, avgOrder: 0 },
        inventory: { totalValue: 0, lowStockItems: 0, outOfStock: 0 },
      },
      alerts: { critical: [], todayPerformance: "needs_attention" },
      quickStats: { hourlySales: [], topProducts: [] },
    };

    res.json({
      success: true,
      message: "Dashboard data fetched with fallback",
      data: emptyDashboard,
    });
  }
});

// EXPORT REPORTS (CSV/JSON)
router.get("/export/:type", async (req, res, next) => {
  try {
    const { type } = req.params; // sales, inventory, customers
    const { format = "json" } = req.query;

    let report;
    switch (type) {
      case "sales":
        report = await ReportService.getDailySalesReport();
        break;
      case "inventory":
        report = await ReportService.getLowStockReport();
        break;
      case "customers":
        report = await ReportService.getCustomerPurchaseHistory();
        break;
      default:
        throw new AppError("Invalid report type", 400);
    }

    if (format === "csv") {
      // Simple CSV conversion (you can enhance this)
      const csv = convertToCSV(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${type}-report-${Date.now()}.csv`
      );
      return res.send(csv);
    }

    res.json({
      success: true,
      message: `${type} report exported successfully`,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// Helper function for CSV export
function convertToCSV(data) {
  // Simple implementation - enhance based on your needs
  if (data.products) {
    const headers = ["Product", "Stock", "Price", "Status", "Suggestion"];
    const rows = data.products.map((p) =>
      [p.name, p.stock, p.price, p.status, p.reorderSuggestion].join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }
  return JSON.stringify(data);
}

export default router;
