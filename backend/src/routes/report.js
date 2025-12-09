// routes/report.js
import { Router } from "express";
import { ReportService } from "../services/reportService.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { validateReportParams } from "../middleware/validation.js";

const router = Router();

// All reports require authentication
router.use(authenticate);

// Role-based authorization middleware
const requireRole = (role) => (req, res, next) => {
  if (!req.user || !req.user.roles.includes(role)) {
    return next(new AppError("Insufficient permissions", 403));
  }
  next();
};

// DAILY SALES REPORT
router.get(
  "/sales/daily",
  validateReportParams(["date"]),
  authorize(["admin", "manager", "staff"]),
  async (req, res, next) => {
    try {
      const { date } = req.query;

      // Validate date format
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
      }

      const report = await ReportService.getDailySalesReport(date);

      // Filter data based on role
      const filteredReport = filterReportByRole(report, req.user.roles);

      res.json({
        success: true,
        message: "Daily sales report generated successfully",
        data: filteredReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          user: req.user.id,
          role: req.user.roles[0],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PAYMENT ANALYTICS REPORT
router.get(
  "/analytics/payment",
  validateReportParams(["startDate", "endDate"]),
  authorize(["admin", "manager"]),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;

      // Validate date range
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        throw new AppError("Start date cannot be after end date", 400);
      }

      const report = await ReportService.getPaymentAnalyticsReport(
        startDate || null,
        endDate || null
      );

      // Filter sensitive data for non-admin roles
      const filteredReport = req.user.roles.includes("admin")
        ? report
        : filterFinancialData(report);

      res.json({
        success: true,
        message: "Payment analytics report generated successfully",
        data: filteredReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          dateRange: { startDate, endDate },
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// CHANNEL PERFORMANCE REPORT
router.get(
  "/analytics/channels",
  validateReportParams(["startDate", "endDate"]),
  authorize(["admin", "manager"]),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;

      const report = await ReportService.getChannelPerformanceReport(
        startDate || null,
        endDate || null
      );

      res.json({
        success: true,
        message: "Channel performance report generated successfully",
        data: report,
        metadata: {
          generatedAt: new Date().toISOString(),
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// LOW STOCK REPORT
router.get(
  "/inventory/low-stock",
  authorize(["admin", "manager", "staff"]),
  async (req, res, next) => {
    try {
      const threshold = parseInt(req.query.threshold) || 10;

      // Validate threshold
      if (threshold < 0 || threshold > 1000) {
        throw new AppError("Threshold must be between 0 and 1000", 400);
      }

      const report = await ReportService.getLowStockReport(threshold);

      res.json({
        success: true,
        message: "Low stock report generated successfully",
        data: report,
        metadata: {
          generatedAt: new Date().toISOString(),
          threshold,
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// CUSTOMER PURCHASE HISTORY
router.get(
  "/customers/history",
  authorize(["admin", "manager"]),
  async (req, res, next) => {
    try {
      const { customerId, limit = 50 } = req.query;

      // Validate limit
      const parsedLimit = parseInt(limit);
      if (parsedLimit < 1 || parsedLimit > 1000) {
        throw new AppError("Limit must be between 1 and 1000", 400);
      }

      const report = await ReportService.getCustomerPurchaseHistory(
        customerId,
        parsedLimit
      );

      // Filter sensitive customer data for non-admin roles
      const filteredReport = req.user.roles.includes("admin")
        ? report
        : filterCustomerData(report);

      res.json({
        success: true,
        message: "Customer purchase history generated successfully",
        data: filteredReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          customerId: customerId || "all",
          limit: parsedLimit,
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// SALES TREND REPORT
router.get(
  "/sales/trend",
  authorize(["admin", "manager"]),
  async (req, res, next) => {
    try {
      const { period = "weekly", weeks = 8 } = req.query;

      // Validate parameters
      if (!["daily", "weekly", "monthly"].includes(period)) {
        throw new AppError("Period must be daily, weekly, or monthly", 400);
      }

      const parsedWeeks = parseInt(weeks);
      if (parsedWeeks < 1 || parsedWeeks > 104) {
        throw new AppError("Weeks must be between 1 and 104", 400);
      }

      const report = await ReportService.getSalesTrendReport(
        period,
        parsedWeeks
      );

      res.json({
        success: true,
        message: "Sales trend report generated successfully",
        data: report,
        metadata: {
          generatedAt: new Date().toISOString(),
          period,
          weeks: parsedWeeks,
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// INVENTORY VALUATION REPORT
router.get(
  "/inventory/valuation",
  authorize(["admin", "manager"]),
  async (req, res, next) => {
    try {
      const report = await ReportService.getInventoryValuationReport();

      // Filter cost data for non-admin roles
      const filteredReport = req.user.roles.includes("admin")
        ? report
        : filterCostData(report);

      res.json({
        success: true,
        message: "Inventory valuation report generated successfully",
        data: filteredReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DEBUG ENDPOINT - Add this for testing
router.get("/debug", authenticate, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Test each report individually
    const tests = {
      dailySales: await ReportService.getDailySalesReport(today),
      paymentAnalytics: await ReportService.getPaymentAnalyticsReport(
        yesterday.toISOString().split("T")[0],
        today
      ),
      lowStock: await ReportService.getLowStockReport(10),
      inventory: await ReportService.getInventoryValuationReport(),
      customerHistory: await ReportService.getCustomerPurchaseHistory(null, 5),
    };

    res.json({
      success: true,
      message: "Debug information",
      data: {
        today,
        testDates: {
          yesterday: yesterday.toISOString().split("T")[0],
          today,
        },
        reports: tests,
        user: req.user,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DASHBOARD SUMMARY - FIXED VERSION
router.get("/dashboard", authenticate, async (req, res, next) => {
  try {
    const userRole = req.user?.roles?.[0] || "staff";

    // Get current date for relevant reports
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Initialize report objects
    let reports = {
      dailySales: null,
      lowStock: null,
      inventory: null,
      payment: null,
      trend: null,
    };

    try {
      // Basic reports for all roles - use today's date
      reports.dailySales = await ReportService.getDailySalesReport(today);
      reports.lowStock = await ReportService.getLowStockReport(10);

      // Additional reports for managers and admins
      if (["admin", "manager"].includes(userRole)) {
        reports.inventory = await ReportService.getInventoryValuationReport();
        reports.payment = await ReportService.getPaymentAnalyticsReport(
          sevenDaysAgo.toISOString().split("T")[0],
          today
        );
        reports.trend = await ReportService.getSalesTrendReport("weekly", 4);
      }
    } catch (error) {
      console.log("Some reports failed, using fallback:", error.message);
      // Continue with whatever reports succeeded
    }

    // Build dashboard based on role with fallback for missing reports
    const dashboard = buildDashboard(reports, userRole);

    res.json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: dashboard,
      metadata: {
        generatedAt: new Date().toISOString(),
        role: userRole,
        user: req.user.id,
        reportStatus: {
          dailySales: !!reports.dailySales,
          lowStock: !!reports.lowStock,
          inventory: !!reports.inventory,
          payment: !!reports.payment,
          trend: !!reports.trend,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    // Return empty dashboard on error
    res.json({
      success: true,
      message: "Dashboard data fetched with fallback",
      data: getEmptyDashboard(),
      metadata: {
        generatedAt: new Date().toISOString(),
        error: error.message,
        user: req.user?.id,
      },
    });
  }
});

// EXPORT REPORTS
router.get(
  "/export/:type",
  authorize(["admin", "manager"]),
  async (req, res, next) => {
    try {
      const { type } = req.params;
      const {
        format = "json",
        startDate,
        endDate,
        threshold,
        customerId,
        limit,
        period,
        weeks,
      } = req.query;

      // Validate export type
      const validTypes = [
        "daily-sales",
        "payment-analytics",
        "channel-performance",
        "inventory",
        "customers",
        "sales-trend",
        "inventory-valuation",
      ];

      if (!validTypes.includes(type)) {
        throw new AppError(
          `Invalid report type. Valid types: ${validTypes.join(", ")}`,
          400
        );
      }

      // Get report based on type
      let report;
      switch (type) {
        case "daily-sales":
          report = await ReportService.getDailySalesReport(startDate);
          break;
        case "payment-analytics":
          report = await ReportService.getPaymentAnalyticsReport(
            startDate,
            endDate
          );
          break;
        case "channel-performance":
          report = await ReportService.getChannelPerformanceReport(
            startDate,
            endDate
          );
          break;
        case "inventory":
          const stockThreshold = parseInt(threshold) || 10;
          report = await ReportService.getLowStockReport(stockThreshold);
          break;
        case "customers":
          const customerLimit = parseInt(limit) || 50;
          report = await ReportService.getCustomerPurchaseHistory(
            customerId,
            customerLimit
          );
          break;
        case "sales-trend":
          const trendPeriod = period || "weekly";
          const trendWeeks = parseInt(weeks) || 8;
          report = await ReportService.getSalesTrendReport(
            trendPeriod,
            trendWeeks
          );
          break;
        case "inventory-valuation":
          report = await ReportService.getInventoryValuationReport();
          break;
      }

      // Filter based on role
      const filteredReport = filterReportForExport(report, req.user.roles);

      // Handle different export formats
      if (format === "csv") {
        const csv = convertToCSV(filteredReport, type);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${type}-report-${Date.now()}.csv`
        );
        return res.send(csv);
      } else if (format === "excel") {
        // Implement Excel export using xlsx library
        const excelBuffer = await convertToExcel(filteredReport, type);
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${type}-report-${Date.now()}.xlsx`
        );
        return res.send(excelBuffer);
      } else if (format === "pdf") {
        // Implement PDF export using pdfkit or similar
        const pdfBuffer = await convertToPDF(filteredReport, type);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${type}-report-${Date.now()}.pdf`
        );
        return res.send(pdfBuffer);
      }

      // Default JSON response
      res.json({
        success: true,
        message: `${type} report exported successfully`,
        data: filteredReport,
        metadata: {
          format,
          generatedAt: new Date().toISOString(),
          type,
          user: req.user.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// HELPER FUNCTIONS

// Filter report data based on user role
function filterReportByRole(report, roles) {
  if (!report) return getEmptyReport();

  if (roles.includes("admin")) {
    return report; // Admin sees everything
  }

  if (roles.includes("manager")) {
    // Managers see most data but not sensitive financial details
    const filtered = { ...report };

    if (filtered.summary) {
      // Remove cost-related data
      delete filtered.summary.totalCost;
      delete filtered.summary.costPrice;
      delete filtered.summary.grossMargin;
    }

    if (filtered.paymentInsights) {
      // Keep payment insights but remove sensitive details
      filtered.paymentInsights = filtered.paymentInsights.map((insight) => ({
        method: insight.method,
        percentage: insight.percentage,
        count: insight.count,
        // Remove amount details
      }));
    }

    return filtered;
  }

  // Staff role - minimal data
  const filtered = { ...report };

  // Only show basic counts and percentages
  if (filtered.summary) {
    filtered.summary = {
      totalOrders: filtered.summary.totalOrders || 0,
      completedOrders: filtered.summary.completedOrders || 0,
      totalItems: filtered.summary.totalItems || 0,
    };
  }

  // Remove all financial data
  delete filtered.paymentInsights;
  delete filtered.channelInsights;
  delete filtered.productInsights;
  delete filtered.hourlyBreakdown;

  return filtered;
}

// Filter financial data
function filterFinancialData(report) {
  if (!report) return getEmptyReport();

  const filtered = JSON.parse(JSON.stringify(report));

  // Remove cost and profit data
  if (filtered.summary) {
    delete filtered.summary.totalCost;
    delete filtered.summary.grossProfit;
    delete filtered.summary.grossMargin;
    delete filtered.summary.costPrice;
  }

  // Remove payment amount details
  if (filtered.paymentSummary) {
    Object.keys(filtered.paymentSummary).forEach((method) => {
      delete filtered.paymentSummary[method].grossRevenue;
      delete filtered.paymentSummary[method].refundAmount;
      delete filtered.paymentSummary[method].netRevenue;
      delete filtered.paymentSummary[method].avgOrderValue;
    });
  }

  return filtered;
}

// Filter customer data
function filterCustomerData(report) {
  if (!report) return { generatedAt: new Date().toISOString(), customers: [] };

  const filtered = JSON.parse(JSON.stringify(report));

  if (filtered.customer) {
    // Remove sensitive contact info
    delete filtered.customer.contact;
    delete filtered.customer.demographics;

    // Keep only aggregated data
    filtered.customer = {
      customerId: filtered.customer.customerId,
      customerName: filtered.customer.customerName,
      summary: filtered.customer.summary,
      behavior: {
        favoriteProducts: filtered.customer.behavior?.favoriteProducts || [],
        favoriteCategories:
          filtered.customer.behavior?.favoriteCategories || [],
      },
    };
  }

  if (filtered.customers) {
    filtered.customers = filtered.customers.map((customer) => ({
      customerId: customer.customerId,
      customerName: customer.customerName,
      summary: customer.summary,
    }));
  }

  return filtered;
}

// Filter cost data
function filterCostData(report) {
  if (!report) return getEmptyReport();

  const filtered = JSON.parse(JSON.stringify(report));

  // Remove cost-related fields
  if (filtered.summary) {
    delete filtered.summary.totalCostValue;
    delete filtered.summary.totalPotentialProfit;
    delete filtered.summary.avgProfitMargin;
  }

  if (filtered.valuation) {
    filtered.valuation = filtered.valuation.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      sellPrice: item.sellPrice,
      stock: item.stock,
      retailValue: item.retailValue,
      status: item.status,
      monthsOfStock: item.monthsOfStock,
      salesLast90Days: item.salesLast90Days,
    }));
  }

  return filtered;
}

// Get empty report structure
function getEmptyReport() {
  return {
    generatedAt: new Date().toISOString(),
    summary: {},
    metadata: { isEmpty: true },
  };
}

// Build dashboard based on role
function buildDashboard(reports, role) {
  const { dailySales, lowStock, inventory, payment, trend } = reports;

  const dashboard = {
    generatedAt: new Date().toISOString(),
    overview: {
      today: {
        revenue: dailySales?.summary?.netRevenue || 0,
        orders: dailySales?.summary?.completedOrders || 0,
        avgOrder: dailySales?.summary?.avgOrderValue || 0,
        totalItems: dailySales?.summary?.totalItems || 0,
        netRevenue: dailySales?.summary?.netRevenue || 0,
      },
      inventory: {
        totalValue: inventory?.summary?.totalRetailValue || 0,
        lowStockItems: lowStock?.summary?.totalLowStock || 0,
        outOfStock: lowStock?.summary?.outOfStock || 0,
        healthyStock: inventory?.breakdown?.healthy || 0,
      },
    },
  };

  // Add payment insights for managers and admins
  if (["admin", "manager"].includes(role)) {
    dashboard.overview.payment = {
      topMethod: payment?.insights?.topPaymentMethod || "cash",
      cashPercentage: payment?.paymentSummary?.cash?.percentage || 0,
      upiPercentage: payment?.paymentSummary?.upi?.percentage || 0,
      cardPercentage: payment?.paymentSummary?.card?.percentage || 0,
      digitalAdoption: payment?.insights?.digitalAdoption || 0,
    };

    dashboard.overview.channels = {
      onlinePercentage: payment?.channelSummary?.online?.percentage || 0,
      offlinePercentage: payment?.channelSummary?.offline?.percentage || 0,
      dominantChannel: payment?.insights?.topChannel || "offline",
    };
  }

  // Add analytics section for managers and admins
  if (["admin", "manager"].includes(role)) {
    dashboard.analytics = {
      paymentSplit: dailySales?.paymentInsights?.split || [],
      channelSplit: dailySales?.channelInsights?.split || [],
      hourlyBreakdown: dailySales?.hourlyBreakdown || [],
      salesTrend: trend?.trend || [],
      topProducts: dailySales?.productInsights?.topProducts || [],
    };
  } else {
    // Basic analytics for staff
    dashboard.analytics = {
      paymentSplit: [],
      channelSplit: [],
      hourlyBreakdown: [],
      salesTrend: [],
      topProducts: dailySales?.productInsights?.topProducts || [],
    };
  }

  // Add alerts for all roles
  dashboard.alerts = {
    critical: (lowStock?.products || [])
      .filter((p) => p.urgency === "critical" || p.urgency === "high")
      .slice(0, 5),
    stockAlerts: generateStockAlerts(lowStock),
    performanceAlerts: generatePerformanceAlerts(dailySales),
    todayPerformance: getPerformanceStatus(
      dailySales?.summary?.netRevenue || 0
    ),
  };

  // Add insights and recommendations for managers and admins
  if (["admin", "manager"].includes(role)) {
    dashboard.insights = {
      recommendations: generateDashboardRecommendations(
        dailySales,
        lowStock,
        payment
      ),
      opportunities: identifyDashboardOpportunities(dailySales, payment, trend),
      trends: {
        paymentTrend: payment?.insights?.paymentTrends || {},
        salesTrend: trend?.insights || {},
        inventoryTrend: lowStock?.insights || {},
      },
    };
  }

  return dashboard;
}

// Get empty dashboard
function getEmptyDashboard() {
  return {
    generatedAt: new Date().toISOString(),
    overview: {
      today: {
        revenue: 0,
        orders: 0,
        avgOrder: 0,
        totalItems: 0,
        netRevenue: 0,
      },
      inventory: {
        totalValue: 0,
        lowStockItems: 0,
        outOfStock: 0,
        healthyStock: 0,
      },
      payment: {
        topMethod: "cash",
        cashPercentage: 0,
        upiPercentage: 0,
        cardPercentage: 0,
        digitalAdoption: 0,
      },
      channels: {
        onlinePercentage: 0,
        offlinePercentage: 100,
        dominantChannel: "offline",
      },
    },
    analytics: {
      paymentSplit: [],
      channelSplit: [],
      hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        sales: 0,
        orders: 0,
      })),
      salesTrend: [],
      topProducts: [],
    },
    alerts: {
      critical: [],
      stockAlerts: [],
      performanceAlerts: [],
      todayPerformance: "needs_attention",
    },
    insights: {
      recommendations: [],
      opportunities: [],
      trends: {},
    },
  };
}

// Generate stock alerts
function generateStockAlerts(lowStockReport) {
  const alerts = [];

  if (!lowStockReport || !lowStockReport.products) return alerts;

  const criticalItems =
    lowStockReport.products?.filter((p) => p.urgency === "critical") || [];
  const highPriorityItems =
    lowStockReport.products?.filter((p) => p.urgency === "high") || [];

  if (criticalItems.length > 0) {
    alerts.push({
      type: "critical",
      message: `${criticalItems.length} items are out of stock`,
      items: criticalItems.map((p) => p.name).slice(0, 3),
      priority: "high",
    });
  }

  if (highPriorityItems.length > 0) {
    alerts.push({
      type: "warning",
      message: `${highPriorityItems.length} items are critically low`,
      items: highPriorityItems.map((p) => p.name).slice(0, 3),
      priority: "medium",
    });
  }

  return alerts;
}

// Generate performance alerts
function generatePerformanceAlerts(dailySales) {
  const alerts = [];

  if (!dailySales || !dailySales.summary) return alerts;

  const netRevenue = dailySales.summary?.netRevenue || 0;
  const refundRate =
    (dailySales.summary?.refundedOrders /
      Math.max(1, dailySales.summary?.completedOrders)) *
      100 || 0;

  if (netRevenue === 0) {
    alerts.push({
      type: "warning",
      message: "No sales recorded today",
      priority: "high",
    });
  }

  if (refundRate > 10) {
    alerts.push({
      type: "warning",
      message: `High refund rate: ${refundRate.toFixed(1)}%`,
      priority: "medium",
    });
  }

  return alerts;
}

// Get performance status
function getPerformanceStatus(totalSales) {
  if (totalSales > 10000) return "excellent";
  if (totalSales > 5000) return "good";
  if (totalSales > 2000) return "average";
  return "needs_attention";
}

// Generate dashboard recommendations
function generateDashboardRecommendations(
  dailySales,
  lowStock,
  paymentAnalytics
) {
  const recommendations = [];

  // Payment method recommendations
  const cashPercentage =
    paymentAnalytics?.paymentSummary?.cash?.percentage || 0;
  if (cashPercentage > 70) {
    recommendations.push({
      type: "payment",
      priority: "high",
      action: "Promote digital payments with instant discounts",
      expectedImpact: "Increase digital payment share by 15-20%",
      timeline: "7 days",
    });
  }

  // Inventory recommendations
  const criticalCount =
    lowStock?.products?.filter((p) => p.urgency === "critical").length || 0;
  if (criticalCount > 0) {
    recommendations.push({
      type: "inventory",
      priority: "high",
      action: `Reorder ${criticalCount} critical items immediately`,
      expectedImpact: "Prevent lost sales",
      timeline: "immediate",
    });
  }

  // Channel optimization
  const onlinePercentage = dailySales?.channelInsights?.onlinePercentage || 0;
  if (onlinePercentage < 20) {
    recommendations.push({
      type: "channel",
      priority: "medium",
      action: "Boost online presence with social media campaigns",
      expectedImpact: "Increase online orders by 25%",
      timeline: "30 days",
    });
  }

  return recommendations;
}

// Identify dashboard opportunities
function identifyDashboardOpportunities(
  dailySales,
  paymentAnalytics,
  salesTrend
) {
  const opportunities = [];

  // UPI growth opportunity
  const upiPercentage = paymentAnalytics?.paymentSummary?.upi?.percentage || 0;
  if (upiPercentage < 15) {
    opportunities.push({
      type: "payment_expansion",
      description: "UPI payments have significant growth potential",
      potentialValue: "Increase revenue by 10-15%",
      actionPlan: "Implement UPI-specific promotions and QR codes",
    });
  }

  // Peak hour optimization
  const peakHour = dailySales?.hourlyBreakdown?.reduce((prev, current) =>
    prev.sales > current.sales ? prev : current
  );
  if (peakHour && peakHour.sales > 0) {
    opportunities.push({
      type: "operations",
      description: `Peak sales at ${peakHour.hour}`,
      potentialValue: "Optimize staffing and inventory",
      actionPlan: "Schedule additional staff during peak hours",
    });
  }

  return opportunities;
}

// Filter report for export
function filterReportForExport(report, roles) {
  if (roles.includes("admin")) {
    return report;
  }

  // For non-admin roles, remove sensitive data
  const filtered = JSON.parse(JSON.stringify(report || {}));

  // Remove cost and profit data
  const removeSensitiveFields = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(removeSensitiveFields);
    } else if (obj && typeof obj === "object") {
      const newObj = {};
      for (const key in obj) {
        if (
          key.includes("cost") ||
          key.includes("profit") ||
          key.includes("margin") ||
          key.includes("price")
        ) {
          continue;
        }
        newObj[key] = removeSensitiveFields(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

  return removeSensitiveFields(filtered);
}

// CSV conversion functions (simplified for example)
function convertToCSV(data, type) {
  // Implementation would convert data to CSV format
  // This is a simplified version
  let csv = "";

  switch (type) {
    case "daily-sales":
      csv = convertDailySalesToCSV(data);
      break;
    // Add other report types...
    default:
      csv = JSON.stringify(data);
  }

  return csv;
}

function convertDailySalesToCSV(data) {
  if (!data || !data.summary) return "No data";

  const headers = ["Metric", "Value"];
  const rows = [
    ["Total Orders", data.summary.totalOrders || 0],
    ["Completed Orders", data.summary.completedOrders || 0],
    ["Net Revenue", data.summary.netRevenue || 0],
    ["Average Order Value", data.summary.avgOrderValue || 0],
  ];

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

async function convertToExcel(data, type) {
  // Implementation using xlsx library
  // This would create an Excel file buffer
  return Buffer.from("");
}

async function convertToPDF(data, type) {
  // Implementation using pdfkit or similar
  // This would create a PDF buffer
  return Buffer.from("");
}

// EXPORT DEFAULT AT THE END
export default router;
