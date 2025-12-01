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
  Users,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AreaChart, BarChart, DonutChart, LineChart } from "@tremor/react";

const API_BASE = "http://localhost:5000/api";

const generateFallbackData = () => ({
  overview: {
    today: {
      revenue: Math.floor(Math.random() * 2000) + 1000,
      orders: Math.floor(Math.random() * 30) + 10,
      avgOrder: Math.floor(Math.random() * 50) + 40,
    },
    inventory: {
      totalValue: Math.floor(Math.random() * 10000) + 5000,
      lowStockItems: Math.floor(Math.random() * 5) + 1,
      outOfStock: Math.floor(Math.random() * 2),
    },
  },
  alerts: {
    critical: [],
    todayPerformance: "good",
  },
  quickStats: {
    hourlySales: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      sales: Math.floor(Math.random() * 300) + 100,
      orders: Math.floor(Math.random() * 15) + 3,
    })),
    topProducts: [
      {
        name: "Premium Espresso",
        quantity: Math.floor(Math.random() * 30) + 40,
      },
      {
        name: "Cappuccino Deluxe",
        quantity: Math.floor(Math.random() * 25) + 35,
      },
      {
        name: "Butter Croissant",
        quantity: Math.floor(Math.random() * 20) + 30,
      },
      { name: "Iced Latte", quantity: Math.floor(Math.random() * 20) + 25 },
      {
        name: "Chocolate Muffin",
        quantity: Math.floor(Math.random() * 15) + 20,
      },
    ],
  },
});

const generateFallbackTrend = () => ({
  trend: Array.from({ length: 8 }, (_, i) => ({
    period: `Week ${i + 1}`,
    totalSales: Math.floor(Math.random() * 3000) + 1500,
    orderCount: Math.floor(Math.random() * 80) + 40,
    avgOrderValue: Math.floor(Math.random() * 40) + 40,
  })),
});

const generateFallbackInventory = () => ({
  breakdown: {
    healthyStock: Math.floor(Math.random() * 15) + 10,
    lowStock: Math.floor(Math.random() * 5) + 2,
    outOfStock: Math.floor(Math.random() * 3),
  },
  summary: {
    totalInventoryValue: Math.floor(Math.random() * 10000) + 5000,
  },
});

export default function ReportView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(
    generateFallbackData()
  );
  const [salesTrend, setSalesTrend] = useState<any>(generateFallbackTrend());
  const [inventoryData, setInventoryData] = useState<any>(
    generateFallbackInventory()
  );
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[v0] No token found, using demo mode with fallback data");
        setIsDemoMode(true);
        setDashboardData(generateFallbackData());
        setSalesTrend(generateFallbackTrend());
        setInventoryData(generateFallbackInventory());
        setLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const dashResponse = await fetch(`${API_BASE}/reports/dashboard`, {
        headers,
      });
      if (!dashResponse.ok)
        throw new Error(`Dashboard API error: ${dashResponse.status}`);
      const dashData = await dashResponse.json();

      const trendResponse = await fetch(
        `${API_BASE}/reports/sales/trend?period=weekly&weeks=8`,
        { headers }
      );
      let trendData: any = generateFallbackTrend();
      if (trendResponse.ok) {
        trendData = await trendResponse.json();
      }

      const invResponse = await fetch(
        `${API_BASE}/reports/inventory/valuation`,
        { headers }
      );
      let invData: any = generateFallbackInventory();
      if (invResponse.ok) {
        invData = await invResponse.json();
      }

      setDashboardData(dashData.data || generateFallbackData());
      setSalesTrend(trendData.data || trendData || generateFallbackTrend());
      setInventoryData(invData.data || invData || generateFallbackInventory());
      setIsDemoMode(false);
    } catch (error) {
      console.error("[v0] Error fetching reports:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load reports"
      );
      setDashboardData(generateFallbackData());
      setSalesTrend(generateFallbackTrend());
      setInventoryData(generateFallbackInventory());
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: "Today's Revenue",
      value: `$${(dashboardData?.overview?.today?.revenue || 0).toFixed(2)}`,
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
      value: `$${(dashboardData?.overview?.inventory?.totalValue || 0).toFixed(
        2
      )}`,
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
        dashboardData?.overview?.inventory?.lowStockItems > 5
          ? "Critical"
          : "Normal",
      trend:
        dashboardData?.overview?.inventory?.lowStockItems > 5
          ? "warning"
          : "up",
      icon: AlertTriangle,
      gradient: "from-amber-500 to-orange-600",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
  ];

  const hourlySalesData =
    dashboardData?.quickStats?.hourlySales?.map((item: any) => ({
      Hour: item.hour,
      Sales: item.sales,
      Orders: item.orders,
    })) || [];

  const weeklyTrendData =
    salesTrend?.trend?.map((item: any) => ({
      Week: item.period,
      Revenue: item.totalSales,
      Orders: item.orderCount,
      "Avg Order": item.avgOrderValue,
    })) || [];

  const topProductsData =
    dashboardData?.quickStats?.topProducts?.map((item: any) => ({
      name: item.name,
      sales: item.quantity,
    })) || [];

  const inventoryDistribution = [
    { name: "Good Stock", value: inventoryData?.breakdown?.healthyStock || 0 },
    { name: "Low Stock", value: inventoryData?.breakdown?.lowStock || 0 },
    { name: "Out of Stock", value: inventoryData?.breakdown?.outOfStock || 0 },
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
                  Real-time business insights
                </p>
              </div>
            </motion.div>
            <motion.div
              className="flex items-center gap-3"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
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
              <Button
                onClick={fetchReportsData}
                variant="outline"
                className="rounded-xl hover:bg-accent transition-all bg-transparent"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
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
                value="inventory"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all py-3"
              >
                <Package className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Inventory</span>
              </TabsTrigger>
              <TabsTrigger
                value="customers"
                className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all py-3"
              >
                <Users className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Customers</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab with Tremor Charts */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
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
                      <LineChart
                        className="h-80"
                        data={weeklyTrendData}
                        index="Week"
                        categories={["Revenue"]}
                        colors={["purple"]}
                        valueFormatter={(value) => `$${value.toFixed(0)}`}
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
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-pink-500" />
                        Top Products
                      </CardTitle>
                      <CardDescription>
                        Best selling items today
                      </CardDescription>
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
                transition={{ delay: 0.8, duration: 0.5 }}
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
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                      Revenue & Orders Analysis
                    </CardTitle>
                    <CardDescription>
                      Comprehensive 8-week performance overview
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
                  transition={{ delay: 0.7, duration: 0.5 }}
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
                        valueFormatter={(value) => `$${value.toFixed(2)}`}
                        showAnimation={true}
                        showLegend={false}
                      />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
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
                        categories={["sales"]}
                        colors={["purple"]}
                        valueFormatter={(value) => `${value} units`}
                        showAnimation={true}
                        layout="vertical"
                        showLegend={false}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-500" />
                        Inventory Status
                      </CardTitle>
                      <CardDescription>
                        Current stock distribution
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart
                        className="h-80"
                        data={inventoryDistribution}
                        category="value"
                        index="name"
                        colors={["emerald", "amber", "rose"]}
                        valueFormatter={(value) => `${value} items`}
                        showAnimation={true}
                        showLabel={true}
                      />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle>Inventory Value</CardTitle>
                      <CardDescription>Total stock valuation</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                      <div className="text-center space-y-4">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            delay: 0.8,
                            type: "spring",
                            stiffness: 200,
                          }}
                          className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-4 border-purple-500/30"
                        >
                          <Package className="w-16 h-16 text-purple-500" />
                        </motion.div>
                        <div>
                          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                            Total Inventory Value
                          </p>
                          <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                            className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
                          >
                            $
                            {(
                              inventoryData?.summary?.totalInventoryValue || 0
                            ).toFixed(2)}
                          </motion.p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 pt-6">
                          {inventoryDistribution.map((item, idx) => (
                            <motion.div
                              key={item.name}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 1 + idx * 0.1 }}
                              className="text-center p-4 rounded-xl bg-muted/30"
                            >
                              <p className="text-2xl font-bold">{item.value}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.name}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* Customers Tab */}
            <TabsContent value="customers" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="text-center py-20"
              >
                <Users className="w-24 h-24 mx-auto text-muted-foreground/30 mb-6" />
                <h3 className="text-2xl font-bold mb-2">
                  Customer Analytics Coming Soon
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Advanced customer insights and analytics will be available in
                  the next update.
                </p>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
