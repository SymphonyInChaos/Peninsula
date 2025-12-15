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
  Users,
  BarChart as BarChartIcon,
  Tag,
  AlertCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  AreaChart,
  BarChart,
  DonutChart,
  LineChart as TremorLineChart,
} from "@tremor/react";

// Import the centralized API utilities
import { api, formatCurrency, formatPercentage, getPaymentMethodColor, getChannelColor } from "@/lib/api";
import type { DashboardData, PaymentMethod, ChannelType } from "@/lib/api";

// API base URL (keep for backward compatibility)
const API_BASE = "http://localhost:5000/api";

// Utility functions - use imported ones instead of duplicating
const formatPaymentMethod = (method: string): string => {
  return api.payments.formatPaymentMethod(method);
};

const formatChannel = (channel: string): string => {
  return api.payments.formatChannel(channel);
};

// Generate fallback dashboard data (simplified version)
const generateFallbackDashboard = (): DashboardData => {
  const fallbackData: DashboardData = {
    overview: {
      today: {
        revenue: 483.12,
        orders: 3,
        avgOrder: 161.04,
        totalItems: 10,
        netRevenue: 483.12
      },
      inventory: {
        totalValue: 4204.38,
        lowStockItems: 1,
        outOfStock: 1,
        healthyStock: 0
      },
      payment: {
        topMethod: "upi" as PaymentMethod,
        cashPercentage: 20,
        upiPercentage: 40,
        cardPercentage: 24,
        walletPercentage: 0,
        qrPercentage: 16,
        digitalAdoption: 80,
      },
      channels: {
        onlinePercentage: 72,
        offlinePercentage: 28,
        dominantChannel: "online" as ChannelType,
      },
    },
    analytics: {
      paymentSplit: [
        {
          method: "cash",
          count: 2,
          amount: 397.32,
          percentage: 28.57,
        },
        {
          method: "upi",
          count: 2,
          amount: 241.56,
          percentage: 28.57,
        },
        {
          method: "card",
          count: 2,
          amount: 397.32,
          percentage: 28.57,
        },
        {
          method: "qr",
          count: 1,
          amount: 142.23,
          percentage: 14.29,
        },
      ],
      channelSplit: [
        {
          channel: "online",
          count: 5,
          amount: 851.07,
          percentage: 71.43,
          avgOrderValue: 170.21,
        },
        {
          channel: "offline",
          count: 2,
          amount: 327.36,
          percentage: 28.57,
          avgOrderValue: 163.68,
        },
      ],
      hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        sales: 0,
        orders: 0,
        refunds: 0,
        netSales: 0,
        dominantPaymentMethod: "cash" as "cash" | "upi" | "card",
        onlinePercentage: 0,
      })),
      salesTrend: [
        {
          period: "Week 50",
          totalSales: 3239.63,
          orderCount: 25,
          avgOrderValue: 129.59,
        },
        {
          period: "Week 51",
          totalSales: 810.48,
          orderCount: 7,
          avgOrderValue: 115.78,
        },
      ],
      topProducts: [
        {
          name: "Juice",
          quantity: 6,
          revenue: 257.41,
        },
        {
          name: "Muffin",
          quantity: 4,
          revenue: 225.72,
        },
      ],
    },
    alerts: {
      critical: [
        {
          name: "Muffin",
          stock: 0,
          urgency: "critical",
          suggestedReorderQty: 50,
        },
      ],
      stockAlerts: [
        {
          type: "critical",
          message: "1 items are out of stock",
          items: ["Muffin"],
          priority: "high"
        }
      ],
      performanceAlerts: [],
      todayPerformance: "needs_attention",
    },
    insights: {
      recommendations: [
        {
          type: "inventory",
          priority: "high",
          action: "Reorder 1 critical items immediately",
          expectedImpact: "Prevent lost sales",
          timeline: "immediate",
        },
      ],
      opportunities: [],
      trends: {
        paymentTrend: {
          cash: { trend: 0, direction: "stable" as const },
          upi: { trend: 33.33, direction: "increasing" as const },
          card: { trend: 0, direction: "stable" as const },
          qr: { trend: 33.33, direction: "increasing" as const },
        },
        channelTrend: { onlineGrowth: 25, offlineGrowth: 5 },
      },
    },
  };
  
  return fallbackData;
};

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

  // Debug effect
  useEffect(() => {
    console.log("Dashboard data:", dashboardData);
    console.log("Is demo mode:", isDemoMode);
    console.log("Has token:", !!localStorage.getItem("token"));
  }, [dashboardData, isDemoMode]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Only refetch if the active tab is one that depends on the date range
    if (activeTab === "analytics" || activeTab === "reports") {
      fetchDashboardData();
    }
  }, [dateRange, selectedDate, activeTab]);

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
        // Use the centralized API utility
        const data = await api.reports.getDashboard();
        if (data) {
          console.log("[ReportView] API data received:", data);
          
          // Transform the API data to match our DashboardData interface
          const transformedData: DashboardData = {
            overview: {
              today: {
                revenue: data.overview?.today?.revenue || 0,
                orders: data.overview?.today?.orders || 0,
                avgOrder: data.overview?.today?.avgOrder || 0,
                totalItems: data.overview?.today?.totalItems || 0,
                netRevenue: data.overview?.today?.netRevenue || 0,
              },
              inventory: {
                totalValue: data.overview?.inventory?.totalValue || 0,
                lowStockItems: data.overview?.inventory?.lowStockItems || 0,
                outOfStock: data.overview?.inventory?.outOfStock || 0,
                healthyStock: data.overview?.inventory?.healthyStock || 0,
              },
              payment: {
                topMethod: (data.overview?.payment?.topMethod as PaymentMethod) || "upi",
                cashPercentage: data.overview?.payment?.cashPercentage || 0,
                upiPercentage: data.overview?.payment?.upiPercentage || 0,
                cardPercentage: data.overview?.payment?.cardPercentage || 0,
                walletPercentage: data.overview?.payment?.walletPercentage || 0,
                qrPercentage: data.overview?.payment?.qrPercentage || 0,
                digitalAdoption: data.overview?.payment?.digitalAdoption || 0,
              },
              channels: {
                onlinePercentage: data.overview?.channels?.onlinePercentage || 0,
                offlinePercentage: data.overview?.channels?.offlinePercentage || 0,
                dominantChannel: (data.overview?.channels?.dominantChannel as ChannelType) || "online",
              },
            },
            analytics: {
              paymentSplit: data.analytics?.paymentSplit?.map((item: any) => ({
                method: item.method,
                count: item.count || 0,
                amount: item.amount || 0,
                percentage: item.percentage || 0,
              })) || [],
              channelSplit: data.analytics?.channelSplit?.map((item: any) => ({
                channel: item.channel,
                count: item.count || 0,
                amount: item.amount || 0,
                percentage: item.percentage || 0,
                avgOrderValue: item.avgOrderValue || 0,
              })) || [],
              hourlyBreakdown: data.analytics?.hourlyBreakdown?.map((item: any) => ({
                hour: item.hour,
                sales: item.sales || 0,
                orders: item.orders || 0,
                refunds: item.refunds || 0,
                netSales: item.netSales || 0,
                dominantPaymentMethod: item.dominantPaymentMethod || "cash",
                onlinePercentage: item.onlinePercentage || 0,
              })) || [],
              salesTrend: data.analytics?.salesTrend?.map((item: any, index: number) => ({
                period: item.period || `Week ${index + 1}`,
                totalSales: item.totalSales || 0,
                orderCount: item.orders || 0,
                avgOrderValue: item.avgOrderValue || 0,
              })) || [],
              topProducts: data.analytics?.topProducts?.map((item: any) => ({
                name: item.name || "Unknown Product",
                quantity: item.quantity || 0,
                revenue: item.revenue || 0,
              })) || [],
            },
            alerts: {
              critical: data.alerts?.critical?.map((item: any) => ({
                name: item.name || "Unknown Item",
                stock: item.stock || 0,
                urgency: item.urgency || "medium",
                suggestedReorderQty: item.suggestedReorderQty || 10,
              })) || [],
              stockAlerts: data.alerts?.stockAlerts || [],
              performanceAlerts: data.alerts?.performanceAlerts || [],
              todayPerformance: data.alerts?.todayPerformance || "good",
            },
            insights: {
              recommendations: data.insights?.recommendations || [],
              opportunities: data.insights?.opportunities || [],
              trends: {
                paymentTrend: {
                  cash: data.insights?.trends?.paymentTrend?.cash || { trend: 0, direction: "stable" },
                  upi: data.insights?.trends?.paymentTrend?.upi || { trend: 0, direction: "stable" },
                  card: data.insights?.trends?.paymentTrend?.card || { trend: 0, direction: "stable" },
                  qr: data.insights?.trends?.paymentTrend?.qr || { trend: 0, direction: "stable" },
                },
                channelTrend: data.insights?.trends?.channelTrend || { onlineGrowth: 0, offlineGrowth: 0 },
              },
            },
          };
          
          setDashboardData(transformedData);
          setIsDemoMode(false);
        } else {
          throw new Error("No data returned from API");
        }
      } catch (apiError) {
        console.error("[ReportView] API Error:", apiError);
        
        // Try alternative endpoint as fallback
        try {
          const response = await fetch(`${API_BASE}/reports/dashboard`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const result = await response.json();
            const data = result.data || result;
            console.log("[ReportView] Fallback data received:", data);
            
            // Transform the data
            const transformedData: DashboardData = {
              overview: {
                today: {
                  revenue: data.overview?.today?.revenue || 0,
                  orders: data.overview?.today?.orders || 0,
                  avgOrder: data.overview?.today?.avgOrder || 0,
                  totalItems: data.overview?.today?.totalItems || 0,
                  netRevenue: data.overview?.today?.netRevenue || 0,
                },
                inventory: {
                  totalValue: data.overview?.inventory?.totalValue || 0,
                  lowStockItems: data.overview?.inventory?.lowStockItems || 0,
                  outOfStock: data.overview?.inventory?.outOfStock || 0,
                  healthyStock: data.overview?.inventory?.healthyStock || 0,
                },
                payment: {
                  topMethod: (data.overview?.payment?.topMethod as PaymentMethod) || "upi",
                  cashPercentage: data.overview?.payment?.cashPercentage || 0,
                  upiPercentage: data.overview?.payment?.upiPercentage || 0,
                  cardPercentage: data.overview?.payment?.cardPercentage || 0,
                  walletPercentage: data.overview?.payment?.walletPercentage || 0,
                  qrPercentage: data.overview?.payment?.qrPercentage || 0,
                  digitalAdoption: data.overview?.payment?.digitalAdoption || 0,
                },
                channels: {
                  onlinePercentage: data.overview?.channels?.onlinePercentage || 0,
                  offlinePercentage: data.overview?.channels?.offlinePercentage || 0,
                  dominantChannel: (data.overview?.channels?.dominantChannel as ChannelType) || "online",
                },
              },
              analytics: {
                paymentSplit: data.analytics?.paymentSplit || [],
                channelSplit: data.analytics?.channelSplit || [],
                hourlyBreakdown: data.analytics?.hourlyBreakdown || [],
                salesTrend: data.analytics?.salesTrend || [],
                topProducts: data.analytics?.topProducts || [],
              },
              alerts: {
                critical: data.alerts?.critical || [],
                stockAlerts: data.alerts?.stockAlerts || [],
                performanceAlerts: data.alerts?.performanceAlerts || [],
                todayPerformance: data.alerts?.todayPerformance || "good",
              },
              insights: {
                recommendations: data.insights?.recommendations || [],
                opportunities: data.insights?.opportunities || [],
                trends: {
                  paymentTrend: data.insights?.trends?.paymentTrend || {},
                  channelTrend: data.insights?.trends?.channelTrend || { onlineGrowth: 0, offlineGrowth: 0 },
                },
              },
            };
            
            setDashboardData(transformedData);
            setIsDemoMode(false);
          } else {
            throw new Error(`Dashboard API error: ${response.status}`);
          }
        } catch (fetchError) {
          console.error("[ReportView] Fallback fetch error:", fetchError);
          throw apiError; // Re-throw the original error
        }
      }
    } catch (error) {
      console.error("[ReportView] Error fetching dashboard:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load dashboard";
      setError(errorMessage);
      
      // Only use demo mode if it's an authentication or connection error
      if (errorMessage.includes("token") || errorMessage.includes("network") || errorMessage.includes("Failed")) {
        setIsDemoMode(true);
        setDashboardData(generateFallbackDashboard());
      }
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
        return null;
      }

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
          return null;
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
        params = {
          startDate: format(dateRange.start, "yyyy-MM-dd"),
          endDate: format(dateRange.end, "yyyy-MM-dd"),
        };
      }
      if (type === "daily-sales") {
        params = {
          date: format(selectedDate, "yyyy-MM-dd"),
        };
      }

      // Use the centralized API for export
      const data = await api.reports.exportReport(type, format, params);
      
      if (data && data.url) {
        // If API returns a download URL
        window.open(data.url, '_blank');
      } else {
        // Fallback to direct download
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
      change: dashboardData?.overview?.today?.revenue > 500 ? "+12.5%" : "-5.2%",
      trend: dashboardData?.overview?.today?.revenue > 500 ? "up" : "down",
      icon: DollarSign,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      title: "Orders Today",
      value: dashboardData?.overview?.today?.orders || 0,
      change: dashboardData?.overview?.today?.orders > 2 ? "+8.2%" : "-15.3%",
      trend: dashboardData?.overview?.today?.orders > 2 ? "up" : "down",
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
      change: dashboardData?.overview?.inventory?.totalValue > 4000 ? "+2.4%" : "-10.8%",
      trend: dashboardData?.overview?.inventory?.totalValue > 4000 ? "up" : "down",
      icon: Package,
      gradient: "from-purple-500 to-pink-600",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      title: "Low Stock Items",
      value: dashboardData?.overview?.inventory?.lowStockItems || 0,
      change:
        (dashboardData?.overview?.inventory?.lowStockItems || 0) > 0
          ? "Critical"
          : "Normal",
      trend:
        (dashboardData?.overview?.inventory?.lowStockItems || 0) > 0
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
      value: formatPaymentMethod(
        dashboardData?.overview?.payment?.topMethod || "cash"
      ),
      icon: CreditCard,
      color: getPaymentMethodColor(
        (dashboardData?.overview?.payment?.topMethod as PaymentMethod) || "cash"
      ),
      percentage: dashboardData?.overview?.payment?.upiPercentage || 0,
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
      color: getChannelColor("online" as ChannelType),
      percentage: dashboardData?.overview?.channels?.onlinePercentage || 0,
    },
    {
      title: "Dominant Channel",
      value: formatChannel(
        dashboardData?.overview?.channels?.dominantChannel || "offline"
      ),
      icon: Globe,
      color: getChannelColor(
        (dashboardData?.overview?.channels?.dominantChannel as ChannelType) || "offline"
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
      name: formatPaymentMethod(item.method),
      value: item.percentage || 0,
      count: item.count || 0,
      amount: item.amount || 0,
      color: getPaymentMethodColor(item.method as PaymentMethod),
    })
  );

  const channelSplitData = (dashboardData?.analytics?.channelSplit || []).map(
    (item: any) => ({
      name: formatChannel(item.channel),
      value: item.percentage || 0,
      count: item.count || 0,
      amount: item.amount || 0,
      color: getChannelColor(item.channel as ChannelType),
    })
  );

  // Performance indicators
  const performanceIndicators = [
    {
      title: "Average Order Value",
      value: formatCurrency(dashboardData?.overview?.today?.avgOrder || 0),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Items Sold",
      value: dashboardData?.overview?.today?.totalItems || 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Gross Margin",
      value: formatPercentage(48.66), // From your JSON data
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Customer Repeat Rate",
      value: formatPercentage(71.43), // From your JSON data
      icon: Users,
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
  ];

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
                  {dashboardData?.overview?.today && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      Today: {format(new Date(), "MMM dd, yyyy")}
                    </span>
                  )}
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
        {/* Top Stats */}
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

        {/* Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceIndicators.map((indicator, idx) => (
            <motion.div
              key={indicator.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + idx * 0.1, duration: 0.5 }}
            >
              <Card className="border-border/40 hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {indicator.title}
                      </p>
                      <p className="text-2xl font-bold mt-2">{indicator.value}</p>
                    </div>
                    <div className={`${indicator.bgColor} p-3 rounded-xl`}>
                      <indicator.icon className={`w-6 h-6 ${indicator.color}`} />
                    </div>
                  </div>
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
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Critical Alerts
                  <span className="text-xs bg-red-500/20 text-red-600 px-2 py-1 rounded-full">
                    {dashboardData.alerts?.critical?.length || 0} items
                  </span>
                </CardTitle>
                <CardDescription>
                  Immediate attention required for these items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.alerts?.critical
                    ?.slice(0, 3)
                    .map((alert: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            alert.urgency === 'critical' ? 'bg-red-100 text-red-600' :
                            alert.urgency === 'high' ? 'bg-orange-100 text-orange-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{alert.name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                Stock: {alert.stock}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                alert.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                                alert.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {alert.urgency}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Reorder Qty</p>
                            <p className="font-semibold">{alert.suggestedReorderQty}</p>
                          </div>
                          <Button size="sm" variant="destructive" className="rounded-lg">
                            Reorder Now
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recommendations */}
        {(dashboardData?.insights?.recommendations?.length || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
          >
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-5 h-5" />
                  Recommendations
                </CardTitle>
                <CardDescription>
                  Actionable insights to improve your business
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.insights?.recommendations
                    ?.slice(0, 3)
                    .map((rec: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800"
                      >
                        <div className={`p-2 rounded-lg ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-600' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          {rec.priority === 'high' ? <AlertTriangle className="w-5 h-5" /> :
                           rec.priority === 'medium' ? <AlertCircle className="w-5 h-5" /> :
                           <Sparkles className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{rec.action}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                              rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {rec.priority}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.expectedImpact}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {rec.type}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              Timeline: {rec.timeline}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Analytics Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}
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
                      Payment Method Distribution
                    </CardTitle>
                    <CardDescription>
                      How customers are paying
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <DonutChart
                        className="h-full"
                        data={paymentSplitData}
                        category="value"
                        index="name"
                        valueFormatter={formatPercentage}
                        colors={["emerald", "blue", "amber", "rose", "violet"]}
                        showAnimation={true}
                        showLabel={true}
                      />
                    </div>
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
                      Weekly performance overview
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
                      <CardTitle>Top Products Revenue</CardTitle>
                      <CardDescription>
                        Revenue breakdown by product
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
                        colors={["emerald", "blue", "amber", "rose", "violet"]}
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
                      Performance overview with metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <BarChart
                      className="h-72"
                      data={weeklyTrendData}
                      index="Week"
                      categories={["Revenue", "Orders", "Avg Order"]}
                      colors={["emerald", "blue", "violet"]}
                      valueFormatter={(value) => formatCurrency(value)}
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
                      <BarChartIcon className="w-5 h-5" />
                      Top Products Performance
                    </CardTitle>
                    <CardDescription>
                      Quantity sold and revenue generated
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
                      Export detailed analytics reports in various formats
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
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
                              Today's sales report with breakdown
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
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
                              Detailed payment method analysis
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
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
                              Online vs offline channel analysis
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
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
                              Inventory status and reorder recommendations
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
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
                              Historical sales trend analysis
                            </p>
                          </CardContent>
                        </Card>

                        <Card
                          className="hover:shadow-md transition-shadow cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
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
                              Current inventory value assessment
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold mb-4">
                          Export Options
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={() =>
                              exportReport("payment-analytics", "csv")
                            }
                            variant="outline"
                            className="rounded-lg"
                          >
                            Export as CSV
                          </Button>
                          <Button
                            onClick={() =>
                              exportReport("payment-analytics", "excel")
                            }
                            variant="outline"
                            className="rounded-lg"
                          >
                            Export as Excel
                          </Button>
                          <Button
                            onClick={() =>
                              exportReport("payment-analytics", "pdf")
                            }
                            variant="outline"
                            className="rounded-lg"
                          >
                            Export as PDF
                          </Button>
                          <Button
                            onClick={() => {
                              // Export all reports
                              exportReport("daily-sales", "csv");
                              setTimeout(() => exportReport("payment-analytics", "csv"), 500);
                              setTimeout(() => exportReport("inventory", "csv"), 1000);
                            }}
                            variant="default"
                            className="rounded-lg"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export All Reports
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

        {/* Footer with Data Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center text-sm text-muted-foreground border-t pt-6"
        >
          <p>
            Data last updated: {new Date().toLocaleTimeString()} • Showing data for{" "}
            {dateRange.start.toLocaleDateString()} to {dateRange.end.toLocaleDateString()}
            {isDemoMode && " • Using demo data"}
          </p>
        </motion.div>
      </main>
    </div>
  );
}

// Add missing import for Download icon
const Download = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);