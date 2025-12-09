"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Sparkles,
  CreditCard,
  Globe,
  LineChart,
  PieChart,
  CalendarIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns"; // added format import
import {
  AreaChart,
  BarChart,
  DonutChart,
  LineChart as TremorLineChart,
} from "@tremor/react";
import {
  api,
  type DashboardData,
  formatCurrency,
  formatPercentage,
  getPaymentMethodColor,
  getChannelColor,
} from "@/lib/api";

const API_BASE = "http://localhost:5000/api";

const generateFallbackDashboard = (): DashboardData => ({
  overview: {
    today: {
      revenue: Math.floor(Math.random() * 2000) + 1000,
      orders: Math.floor(Math.random() * 30) + 10,
      avgOrder: Math.floor(Math.random() * 50) + 40,
      totalItems: Math.floor(Math.random() * 100) + 50,
      netRevenue: Math.floor(Math.random() * 2000) + 1000,
    },
    inventory: {
      totalValue: Math.floor(Math.random() * 10000) + 5000,
      lowStockItems: Math.floor(Math.random() * 5) + 1,
      outOfStock: Math.floor(Math.random() * 2),
      healthyStock: Math.floor(Math.random() * 15) + 10,
    },
    payment: {
      topMethod: "cash",
      cashPercentage: Math.floor(Math.random() * 40) + 30,
      upiPercentage: Math.floor(Math.random() * 30) + 20,
      cardPercentage: Math.floor(Math.random() * 20) + 10,
      digitalAdoption: Math.floor(Math.random() * 40) + 30,
    },
    channels: {
      onlinePercentage: Math.floor(Math.random() * 40) + 10,
      offlinePercentage: Math.floor(Math.random() * 60) + 40,
      dominantChannel: Math.random() > 0.5 ? "online" : "offline",
    },
  },
  analytics: {
    paymentSplit: [
      {
        method: "cash",
        count: Math.floor(Math.random() * 50) + 30,
        amount: Math.floor(Math.random() * 1000) + 500,
        percentage: Math.floor(Math.random() * 40) + 30,
      },
      {
        method: "upi",
        count: Math.floor(Math.random() * 40) + 20,
        amount: Math.floor(Math.random() * 800) + 400,
        percentage: Math.floor(Math.random() * 30) + 20,
      },
      {
        method: "card",
        count: Math.floor(Math.random() * 30) + 15,
        amount: Math.floor(Math.random() * 600) + 300,
        percentage: Math.floor(Math.random() * 20) + 10,
      },
      {
        method: "other",
        count: Math.floor(Math.random() * 20) + 10,
        amount: Math.floor(Math.random() * 400) + 200,
        percentage: Math.floor(Math.random() * 10) + 5,
      },
    ],
    channelSplit: [
      {
        channel: "online",
        count: Math.floor(Math.random() * 40) + 20,
        amount: Math.floor(Math.random() * 1500) + 800,
        percentage: Math.floor(Math.random() * 40) + 20,
        avgOrderValue: Math.floor(Math.random() * 60) + 40,
      },
      {
        channel: "offline",
        count: Math.floor(Math.random() * 60) + 40,
        amount: Math.floor(Math.random() * 2000) + 1000,
        percentage: Math.floor(Math.random() * 60) + 40,
        avgOrderValue: Math.floor(Math.random() * 50) + 30,
      },
    ],
    hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      sales: Math.floor(Math.random() * 300) + 100,
      orders: Math.floor(Math.random() * 15) + 3,
      refunds: Math.floor(Math.random() * 20),
      netSales: Math.floor(Math.random() * 280) + 120,
      dominantPaymentMethod: ["cash", "upi", "card"][
        Math.floor(Math.random() * 3)
      ] as "cash" | "upi" | "card",
      onlinePercentage: Math.floor(Math.random() * 100),
    })),
    salesTrend: Array.from({ length: 8 }, (_, i) => ({
      period: `Week ${i + 1}`,
      totalSales: Math.floor(Math.random() * 3000) + 1500,
      orderCount: Math.floor(Math.random() * 80) + 40,
      avgOrderValue: Math.floor(Math.random() * 40) + 40,
    })),
    topProducts: [
      {
        name: "Premium Espresso",
        quantity: Math.floor(Math.random() * 30) + 40,
        revenue: Math.floor(Math.random() * 500) + 300,
      },
      {
        name: "Cappuccino Deluxe",
        quantity: Math.floor(Math.random() * 25) + 35,
        revenue: Math.floor(Math.random() * 450) + 250,
      },
      {
        name: "Butter Croissant",
        quantity: Math.floor(Math.random() * 20) + 30,
        revenue: Math.floor(Math.random() * 400) + 200,
      },
      {
        name: "Iced Latte",
        quantity: Math.floor(Math.random() * 20) + 25,
        revenue: Math.floor(Math.random() * 350) + 150,
      },
      {
        name: "Chocolate Muffin",
        quantity: Math.floor(Math.random() * 15) + 20,
        revenue: Math.floor(Math.random() * 300) + 100,
      },
    ],
  },
  alerts: {
    critical: [
      {
        name: "Premium Coffee Beans",
        stock: 2,
        urgency: "high",
        suggestedReorderQty: 50,
      },
      {
        name: "Paper Cups (Large)",
        stock: 0,
        urgency: "critical",
        suggestedReorderQty: 100,
      },
    ],
    paymentAlerts: [
      {
        type: "high_refund",
        message: "Card refunds increased by 15% this week",
        priority: "medium",
      },
    ],
    channelAlerts: [
      {
        type: "growth_opportunity",
        message: "Online orders increased by 25% this week",
        priority: "low",
      },
    ],
    todayPerformance: "good",
  },
  insights: {
    recommendations: [
      {
        type: "payment",
        priority: "medium",
        action: "Promote UPI payments with 5% cashback",
        expectedImpact: "Increase UPI share by 10%",
        timeline: "2 weeks",
      },
      {
        type: "inventory",
        priority: "high",
        action: "Reorder critical stock items immediately",
        expectedImpact: "Prevent lost sales",
        timeline: "immediate",
      },
    ],
    opportunities: [
      {
        type: "peak_hours",
        description: "High traffic between 3-6 PM",
        potentialValue: "Increase staffing by 20% during peak hours",
      },
    ],
    trends: {
      paymentTrend: {
        cash: { trend: -5, direction: "decreasing" },
        upi: { trend: 8, direction: "increasing" },
      },
      channelTrend: { onlineGrowth: 25, offlineGrowth: 5 },
    },
  },
});

export default function ReportView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>(
    generateFallbackDashboard()
  );
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Only refetch if the active tab is one that depends on the date range
    // This prevents unnecessary refetches when switching tabs
    if (activeTab === "analytics" || activeTab === "reports") {
      fetchDashboardData();
    }
  }, [dateRange, selectedDate, activeTab]); // Added activeTab as dependency

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[ReportView] No token found, using demo mode");
        setIsDemoMode(true);
        setDashboardData(generateFallbackDashboard());
        setLoading(false);
        return;
      }

      try {
        // Use the API utility from api.ts
        const data = await api.reports.getDashboard();
        setDashboardData(data);
        setIsDemoMode(false);
      } catch (apiError) {
        console.error("[ReportView] API Error:", apiError);

        // Fallback to direct fetch if API utility fails
        const response = await fetch(`${API_BASE}/reports/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Dashboard API error: ${response.status}`);
        }

        const result = await response.json();
        setDashboardData(result.data || result);
        setIsDemoMode(false);
      }
    } catch (error) {
      console.error("[ReportView] Error fetching dashboard:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load dashboard"
      );
      setDashboardData(generateFallbackDashboard());
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async (type: string, params?: any) => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        setIsDemoMode(true);
        return;
      }

      const url = `${API_BASE}/reports`;
      let response;

      switch (type) {
        case "daily-sales":
          response = await api.reports.getDailySales(params?.date);
          break;
        case "payment-analytics":
          response = await api.reports.getPaymentAnalytics(
            params?.startDate,
            params?.endDate
          );
          break;
        case "channel-performance":
          response = await api.reports.getChannelPerformance(
            params?.startDate,
            params?.endDate
          );
          break;
        case "inventory":
          response = await api.reports.getLowStock(params?.threshold);
          break;
        case "sales-trend":
          response = await api.reports.getSalesTrend(
            params?.period,
            params?.weeks
          );
          break;
        case "inventory-valuation":
          response = await api.reports.getInventoryValuation();
          break;
        default:
          return;
      }

      return response;
    } catch (error) {
      console.error(`[ReportView] Error fetching ${type}:`, error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (type: string, format = "csv") => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login to export reports");
        return;
      }

      let params: any = {};
      if (type === "payment-analytics" || type === "channel-performance") {
        // updated to use Date objects and format them correctly
        params = {
          startDate: format(dateRange.start, "yyyy-MM-dd"),
          endDate: format(dateRange.end, "yyyy-MM-dd"),
        };
      }
      // Add logic for other report types that might need date parameters
      if (type === "daily-sales") {
        params = {
          date: format(selectedDate, "yyyy-MM-dd"),
        };
      }

      const url =
        `${API_BASE}/reports/export/${type}?format=${format}` +
        (params.startDate ? `&startDate=${params.startDate}` : "") +
        (params.endDate ? `&endDate=${params.endDate}` : "") +
        (params.date ? `&date=${params.date}` : "");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${type}-report-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("[ReportView] Export error:", error);
      alert("Failed to export report");
    }
  };

  const stats = [
    {
      title: "Today's Revenue",
      value: formatCurrency(dashboardData?.overview?.today?.revenue || 0),
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      title: "Orders Today",
      value: dashboardData?.overview?.today?.orders || 0,
      change: "+8.2%",
      trend: "up",
      icon: ShoppingCart,
      gradient: "from-blue-500 to-cyan-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      title: "Inventory Value",
      value: formatCurrency(
        dashboardData?.overview?.inventory?.totalValue || 0
      ),
      change: "-2.4%",
      trend: "down",
      icon: Package,
      gradient: "from-purple-500 to-pink-600",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      title: "Low Stock Items",
      value: dashboardData?.overview?.inventory?.lowStockItems || 0,
      change:
        (dashboardData?.overview?.inventory?.lowStockItems || 0) > 5
          ? "Critical"
          : "Normal",
      trend:
        (dashboardData?.overview?.inventory?.lowStockItems || 0) > 5
          ? "warning"
          : "up",
      icon: AlertTriangle,
      gradient: "from-amber-500 to-orange-600",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
  ];

  const paymentStats = [
    {
      title: "Top Payment Method",
      value: api.payments.formatPaymentMethod(
        dashboardData?.overview?.payment?.topMethod || "cash"
      ),
      icon: CreditCard,
      color: getPaymentMethodColor(
        (dashboardData?.overview?.payment?.topMethod as any) || "cash"
      ),
      percentage: dashboardData?.overview?.payment?.cashPercentage || 0,
    },
    {
      title: "Digital Adoption",
      value: formatPercentage(
        dashboardData?.overview?.payment?.digitalAdoption || 0
      ),
      icon: CreditCard,
      color: "#3b82f6",
      percentage: dashboardData?.overview?.payment?.digitalAdoption || 0,
    },
    {
      title: "Online Orders",
      value: formatPercentage(
        dashboardData?.overview?.channels?.onlinePercentage || 0
      ),
      icon: Globe,
      color: getChannelColor("online"),
      percentage: dashboardData?.overview?.channels?.onlinePercentage || 0,
    },
    {
      title: "Dominant Channel",
      value: api.payments.formatChannel(
        dashboardData?.overview?.channels?.dominantChannel || "offline"
      ),
      icon: Globe,
      color: getChannelColor(
        (dashboardData?.overview?.channels?.dominantChannel as any) || "offline"
      ),
      percentage:
        dashboardData?.overview?.channels?.dominantChannel === "online"
          ? dashboardData?.overview?.channels?.onlinePercentage || 0
          : 100 - (dashboardData?.overview?.channels?.onlinePercentage || 0),
    },
  ];

  const hourlySalesData = (dashboardData?.analytics?.hourlyBreakdown || []).map(
    (item: any) => ({
      Hour: item.hour,
      Sales: item.sales || 0,
      Orders: item.orders || 0,
      NetSales: item.netSales || 0,
    })
  );

  const weeklyTrendData = (dashboardData?.analytics?.salesTrend || []).map(
    (item: any) => ({
      Week: item.period || "Week 1",
      Revenue: item.totalSales || 0,
      Orders: item.orderCount || 0,
      "Avg Order": item.avgOrderValue || 0,
    })
  );

  const topProductsData = (dashboardData?.analytics?.topProducts || []).map(
    (item: any) => ({
      name: item.name || "Product",
      sales: item.quantity || 0,
      revenue: item.revenue || 0,
    })
  );

  const paymentSplitData = (dashboardData?.analytics?.paymentSplit || []).map(
    (item: any) => ({
      name: api.payments.formatPaymentMethod(item.method),
      value: item.percentage || 0,
      count: item.count || 0,
      amount: item.amount || 0,
      color: getPaymentMethodColor(item.method),
    })
  );

  const channelSplitData = (dashboardData?.analytics?.channelSplit || []).map(
    (item: any) => ({
      name: api.payments.formatChannel(item.channel),
      value: item.percentage || 0,
      count: item.count || 0,
      amount: item.amount || 0,
      color: getChannelColor(item.channel),
    })
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          >
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground font-medium"
          >
            Loading analytics dashboard...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm"
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <motion.div
              className="flex items-center gap-4"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl blur-sm opacity-50" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Analytics Dashboard
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Real-time business insights and reports
                </p>
              </div>
            </motion.div>
            <motion.div
              className="flex items-center gap-3"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-xl justify-start text-left font-normal bg-transparent"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.start, "MMM dd")} -{" "}
                      {format(dateRange.end, "MMM dd, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-3 space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Start Date</p>
                        <Calendar
                          mode="single"
                          selected={dateRange.start}
                          onSelect={(date) =>
                            date && setDateRange({ ...dateRange, start: date })
                          }
                          initialFocus
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">End Date</p>
                        <Calendar
                          mode="single"
                          selected={dateRange.end}
                          onSelect={(date) =>
                            date && setDateRange({ ...dateRange, end: date })
                          }
                          initialFocus
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <AnimatePresence>
                {isDemoMode && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="text-sm font-medium text-blue-600 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Demo Mode
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex gap-2">
                <Button
                  onClick={() => exportReport("daily-sales", "csv")}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  Export CSV
                </Button>
                <Button
                  onClick={fetchDashboardData}
                  variant="outline"
                  className="rounded-xl hover:bg-accent transition-all bg-transparent"
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5, ease: "easeOut" }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <Card className="border-border/50 overflow-hidden relative group hover:shadow-2xl hover:border-primary/20 transition-all duration-300">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                      {stat.title}
                    </CardDescription>
                    <motion.div
                      className={`w-12 h-12 rounded-2xl ${stat.iconBg} flex items-center justify-center`}
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                    </motion.div>
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: idx * 0.1 + 0.2,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className="text-4xl font-bold mb-2"
                  >
                    {stat.value}
                  </motion.p>
                  <div
                    className={`flex items-center gap-1 text-sm font-medium ${
                      stat.trend === "up"
                        ? "text-emerald-600"
                        : stat.trend === "down"
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    {stat.trend === "up" && (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                    {stat.trend === "down" && (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {stat.trend === "warning" && (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span>{stat.change}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Payment and Channel Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {paymentStats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.4 + idx * 0.1,
                duration: 0.5,
                ease: "easeOut",
              }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <Card className="border-border/50 overflow-hidden relative group hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                      {stat.title}
                    </CardDescription>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${stat.color}20` }}
                    >
                      <stat.icon
                        className="w-5 h-5"
                        style={{ color: stat.color }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.4 + idx * 0.1 + 0.2,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className="text-2xl font-bold mb-2"
                  >
                    {stat.value}
                  </motion.p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${stat.percentage}%`,
                        backgroundColor: stat.color,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stat.percentage.toFixed(1)}% of total
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Alerts Section */}
        {(dashboardData?.alerts?.critical?.length || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Critical Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardData.alerts?.critical
                    ?.slice(0, 3)
                    .map((alert: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800"
                      >
                        <div>
                          <p className="font-medium">{alert.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Stock: {alert.stock} | Urgency: {alert.urgency}
                          </p>
                        </div>
                        <Button size="sm" variant="destructive">
                          Reorder
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-8"
          >
            <TabsList className="grid w-full grid-cols-4 p-1.5 bg-muted/50 rounded-2xl h-auto">
              <TabsTrigger
                value="overview"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all py-3"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all py-3"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sales</span>
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all py-3"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all py-3"
              >
                <LineChart className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-500" />
                        Sales Trend
                      </CardTitle>
                      <CardDescription>
                        Weekly revenue performance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TremorLineChart
                        className="h-80"
                        data={weeklyTrendData}
                        index="Week"
                        categories={["Revenue"]}
                        colors={["purple"]}
                        valueFormatter={(value) => formatCurrency(value)}
                        showAnimation={true}
                        showLegend={false}
                        curveType="natural"
                      />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-pink-500" />
                        Top Products
                      </CardTitle>
                      <CardDescription>Best selling items</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart
                        className="h-80"
                        data={topProductsData}
                        category="sales"
                        index="name"
                        colors={["purple", "pink", "cyan", "amber", "emerald"]}
                        valueFormatter={(value) => `${value} units`}
                        showAnimation={true}
                        showLabel={true}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-cyan-500" />
                      Today's Hourly Performance
                    </CardTitle>
                    <CardDescription>
                      Real-time sales and order tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AreaChart
                      className="h-80"
                      data={hourlySalesData}
                      index="Hour"
                      categories={["Sales", "Orders"]}
                      colors={["cyan", "violet"]}
                      valueFormatter={(value) => `${value}`}
                      showAnimation={true}
                      showLegend={true}
                      showGridLines={true}
                      curveType="natural"
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      Revenue & Orders Analysis
                    </CardTitle>
                    <CardDescription>
                      8-week performance overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AreaChart
                      className="h-96"
                      data={weeklyTrendData}
                      index="Week"
                      categories={["Revenue", "Orders"]}
                      colors={["emerald", "blue"]}
                      valueFormatter={(value) => `${value}`}
                      showAnimation={true}
                      showLegend={true}
                      showGridLines={true}
                      curveType="natural"
                      stack={false}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle>Average Order Value</CardTitle>
                      <CardDescription>Trends over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BarChart
                        className="h-80"
                        data={weeklyTrendData}
                        index="Week"
                        categories={["Avg Order"]}
                        colors={["amber"]}
                        valueFormatter={(value) => formatCurrency(value)}
                        showAnimation={true}
                        showLegend={false}
                      />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle>Top Products Distribution</CardTitle>
                      <CardDescription>
                        Sales breakdown by product
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BarChart
                        className="h-80"
                        data={topProductsData}
                        index="name"
                        categories={["revenue"]}
                        colors={["purple"]}
                        valueFormatter={(value) => formatCurrency(value)}
                        showAnimation={true}
                        layout="vertical"
                        showLegend={false}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="rounded-2xl border-border/40 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Hourly Sales Breakdown
                        </CardTitle>
                        <CardDescription>
                          Sales performance throughout the day
                        </CardDescription>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl bg-transparent"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(selectedDate, "MMM dd, yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <AreaChart
                      className="h-72"
                      data={hourlySalesData}
                      index="Hour"
                      categories={["Sales", "Orders", "NetSales"]}
                      colors={["emerald", "blue", "violet"]}
                      valueFormatter={formatCurrency}
                      showLegend={true}
                      showGridLines={true}
                      showAnimation={true}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <Card className="rounded-2xl border-border/40 shadow-lg overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5" />
                        Payment Method Split
                      </CardTitle>
                      <CardDescription>
                        Distribution by payment type
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <DonutChart
                        className="h-72"
                        data={paymentSplitData}
                        category="value"
                        index="name"
                        valueFormatter={formatPercentage}
                        colors={["emerald", "blue", "amber", "rose"]}
                        showAnimation={true}
                      />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <Card className="rounded-2xl border-border/40 shadow-lg overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Channel Performance
                      </CardTitle>
                      <CardDescription>Online vs Offline sales</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <DonutChart
                        className="h-72"
                        data={channelSplitData}
                        category="value"
                        index="name"
                        valueFormatter={formatPercentage}
                        colors={["cyan", "orange"]}
                        showAnimation={true}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="rounded-2xl border-border/40 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10">
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="w-5 h-5" />
                      Weekly Sales Trend
                    </CardTitle>
                    <CardDescription>
                      8-week performance overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <BarChart
                      className="h-72"
                      data={weeklyTrendData}
                      index="Week"
                      categories={["Revenue", "Orders", "Avg Order"]}
                      colors={["emerald", "blue", "violet"]}
                      valueFormatter={formatCurrency}
                      showLegend={true}
                      showGridLines={true}
                      showAnimation={true}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Card className="rounded-2xl border-border/40 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Top Selling Products
                    </CardTitle>
                    <CardDescription>
                      Best performers by quantity and revenue
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <BarChart
                      className="h-72"
                      data={topProductsData}
                      index="name"
                      categories={["sales", "revenue"]}
                      colors={["indigo", "rose"]}
                      valueFormatter={(value: number) => value.toString()}
                      showLegend={true}
                      showGridLines={true}
                      showAnimation={true}
                      layout="vertical"
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="w-5 h-5 text-blue-500" />
                      Generate Reports
                    </CardTitle>
                    <CardDescription>
                      Export detailed analytics reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed"
                          onClick={() => exportReport("daily-sales", "csv")}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Daily Sales
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Today's sales report
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed"
                          onClick={() =>
                            exportReport("payment-analytics", "csv")
                          }
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Payment Analytics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Payment method analysis
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed"
                          onClick={() =>
                            exportReport("channel-performance", "csv")
                          }
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              Channel Performance
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Online vs offline analysis
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed"
                          onClick={() => exportReport("inventory", "csv")}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Low Stock Report
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Inventory status report
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed"
                          onClick={() => exportReport("sales-trend", "csv")}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <TrendingUp className="w-4 h-4" />
                              Sales Trend
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Sales trend analysis
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed"
                          onClick={() =>
                            exportReport("inventory-valuation", "csv")
                          }
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Inventory Valuation
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Inventory value report
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold mb-4">
                          Export Options
                        </h3>
                        <div className="flex gap-3">
                          <Button
                            onClick={() =>
                              exportReport("payment-analytics", "csv")
                            }
                            variant="outline"
                          >
                            Export as CSV
                          </Button>
                          <Button
                            onClick={() =>
                              exportReport("payment-analytics", "excel")
                            }
                            variant="outline"
                          >
                            Export as Excel
                          </Button>
                          <Button
                            onClick={() =>
                              exportReport("payment-analytics", "pdf")
                            }
                            variant="outline"
                          >
                            Export as PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-6 text-center"
          >
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
              Failed to Load Dashboard
            </h3>
            <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={fetchDashboardData} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button onClick={() => setIsDemoMode(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Use Demo Mode
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
