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
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart,
  Legend,
} from "recharts";

const API_BASE = "http://localhost:5000/api";

export default function ReportsView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesTrend, setSalesTrend] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setLoading(true);

      // Fetch dashboard overview
      const dashResponse = await fetch(`${API_BASE}/reports/dashboard`);
      const dashData = await dashResponse.json();

      // Fetch sales trend
      const trendResponse = await fetch(
        `${API_BASE}/reports/sales/trend?period=weekly&weeks=8`
      );
      const trendData = await trendResponse.json();

      // Fetch inventory valuation
      const invResponse = await fetch(
        `${API_BASE}/reports/inventory/valuation`
      );
      const invData = await invResponse.json();

      setDashboardData(dashData.data);
      setSalesTrend(trendData.data);
      setInventoryData(invData.data);
    } catch (error) {
      console.error("[v0] Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading reports...</p>
        </motion.div>
      </div>
    );
  }

  const stats = [
    {
      title: "Today's Revenue",
      value: `$${dashboardData?.overview?.today?.revenue?.toFixed(2) || 0}`,
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Orders Today",
      value: dashboardData?.overview?.today?.orders || 0,
      change: "+8.2%",
      trend: "up",
      icon: ShoppingCart,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Inventory Value",
      value: `$${
        dashboardData?.overview?.inventory?.totalValue?.toFixed(2) || 0
      }`,
      change: "-2.4%",
      trend: "down",
      icon: Package,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Low Stock Items",
      value: dashboardData?.overview?.inventory?.lowStockItems || 0,
      change: "Critical",
      trend: "warning",
      icon: AlertTriangle,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  // Transform hourly sales data for chart
  const hourlySalesData =
    dashboardData?.quickStats?.hourlySales?.map((item: any) => ({
      hour: item.hour,
      sales: item.sales,
      orders: item.orders,
    })) || [];

  // Transform weekly trend data
  const weeklyTrendData =
    salesTrend?.trend?.map((item: any) => ({
      period: item.period,
      revenue: item.totalSales,
      orders: item.orderCount,
      avg: item.avgOrderValue,
    })) || [];

  // Top products pie chart data
  const MODERN_COLORS = [
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#3B82F6", // Blue
    "#F97316", // Orange
  ];

  const topProductsData =
    dashboardData?.quickStats?.topProducts?.map((item: any, idx: number) => ({
      name: item.name,
      value: item.quantity,
      fill: MODERN_COLORS[idx % MODERN_COLORS.length],
    })) || [];

  // Inventory distribution
  const inventoryDistribution = [
    {
      name: "Good Stock",
      value: inventoryData?.breakdown?.healthyStock || 0,
      fill: "#10B981", // Emerald
    },
    {
      name: "Low Stock",
      value: inventoryData?.breakdown?.lowStock || 0,
      fill: "#F59E0B", // Amber
    },
    {
      name: "Out of Stock",
      value: inventoryData?.breakdown?.outOfStock || 0,
      fill: "#EF4444", // Red
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Real-time business insights
                </p>
              </div>
            </div>
            <Button
              onClick={fetchReportsData}
              variant="outline"
              className="rounded-xl"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="border-border overflow-hidden relative group hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs uppercase tracking-wider">
                      {stat.title}
                    </CardDescription>
                    <div
                      className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}
                    >
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <motion.p
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.1 + 0.2, type: "spring" }}
                        className="text-3xl font-bold"
                      >
                        {stat.value}
                      </motion.p>
                      <div
                        className={`flex items-center gap-1 text-sm mt-1 ${
                          stat.trend === "up"
                            ? "text-emerald-500"
                            : stat.trend === "down"
                            ? "text-red-500"
                            : "text-amber-500"
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
                        <span className="font-medium">{stat.change}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: idx * 0.1 + 0.3 }}
                />
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-4 p-1 bg-muted/50 rounded-2xl">
              <TabsTrigger
                value="overview"
                className="rounded-xl data-[state=active]:bg-background"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-xl data-[state=active]:bg-background"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Sales
              </TabsTrigger>
              <TabsTrigger
                value="inventory"
                className="rounded-xl data-[state=active]:bg-background"
              >
                <Package className="w-4 h-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger
                value="customers"
                className="rounded-xl data-[state=active]:bg-background"
              >
                <Users className="w-4 h-4 mr-2" />
                Customers
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend Chart */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Sales Trend</CardTitle>
                    <CardDescription>
                      Weekly revenue performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyTrendData}>
                        <defs>
                          <linearGradient
                            id="colorRevenue"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#8B5CF6"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#8B5CF6"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="period"
                          stroke="#9CA3AF"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(17, 24, 39, 0.95)",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#8B5CF6"
                          strokeWidth={3}
                          dot={{ fill: "#8B5CF6", r: 5 }}
                          activeDot={{ r: 7, fill: "#A78BFA" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Products */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Top Products</CardTitle>
                    <CardDescription>Best selling items</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={topProductsData}
                          cx="50%"
                          cy="50%"
                          labelLine={{
                            stroke: "#9CA3AF",
                            strokeWidth: 1,
                          }}
                          label={({
                            cx,
                            cy,
                            midAngle,
                            innerRadius,
                            outerRadius,
                            percent,
                            name,
                          }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 25;
                            const x =
                              cx + radius * Math.cos(-midAngle * RADIAN);
                            const y =
                              cy + radius * Math.sin(-midAngle * RADIAN);

                            return (
                              <text
                                x={x}
                                y={y}
                                fill="#E5E7EB"
                                textAnchor={x > cx ? "start" : "end"}
                                dominantBaseline="central"
                                style={{ fontSize: "12px", fontWeight: "500" }}
                              >
                                {`${name} ${(percent * 100).toFixed(0)}%`}
                              </text>
                            );
                          }}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {topProductsData.map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.fill}
                              stroke="#1F2937"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(17, 24, 39, 0.95)",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Hourly Sales */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Today's Hourly Sales</CardTitle>
                  <CardDescription>Real-time sales performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlySalesData}>
                      <defs>
                        <linearGradient
                          id="colorSales"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#06B6D4"
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor="#3B82F6"
                            stopOpacity={0.8}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#374151"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="hour"
                        stroke="#9CA3AF"
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(17, 24, 39, 0.95)",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Bar
                        dataKey="sales"
                        fill="url(#colorSales)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Revenue Overview</CardTitle>
                    <CardDescription>Monthly revenue breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={weeklyTrendData}>
                        <defs>
                          <linearGradient
                            id="colorArea"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#EC4899"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#EC4899"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="period"
                          stroke="#9CA3AF"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(17, 24, 39, 0.95)",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#EC4899"
                          strokeWidth={3}
                          fill="url(#colorArea)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Order Statistics</CardTitle>
                    <CardDescription>Orders and average values</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyTrendData}>
                        <defs>
                          <linearGradient
                            id="colorOrders"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#F59E0B"
                              stopOpacity={1}
                            />
                            <stop
                              offset="100%"
                              stopColor="#F97316"
                              stopOpacity={0.8}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="period"
                          stroke="#9CA3AF"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#9CA3AF"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#9CA3AF"
                          style={{ fontSize: "12px" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(17, 24, 39, 0.95)",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="orders"
                          fill="url(#colorOrders)"
                          radius={[8, 8, 0, 0]}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="avg"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ fill: "#10B981", r: 4 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Inventory Distribution */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Inventory Distribution</CardTitle>
                    <CardDescription>Stock status overview</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={inventoryDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={{
                            stroke: "#9CA3AF",
                            strokeWidth: 1,
                          }}
                          label={({
                            cx,
                            cy,
                            midAngle,
                            innerRadius,
                            outerRadius,
                            percent,
                            name,
                          }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 25;
                            const x =
                              cx + radius * Math.cos(-midAngle * RADIAN);
                            const y =
                              cy + radius * Math.sin(-midAngle * RADIAN);

                            return (
                              <text
                                x={x}
                                y={y}
                                fill="#E5E7EB"
                                textAnchor={x > cx ? "start" : "end"}
                                dominantBaseline="central"
                                style={{ fontSize: "12px", fontWeight: "500" }}
                              >
                                {`${name} ${(percent * 100).toFixed(0)}%`}
                              </text>
                            );
                          }}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {inventoryDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.fill}
                              stroke="#1F2937"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(17, 24, 39, 0.95)",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Stock Value Trend</CardTitle>
                    <CardDescription>
                      Inventory valuation over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyTrendData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#374151"
                          opacity={0.3}
                        />
                        <XAxis
                          dataKey="period"
                          stroke="#9CA3AF"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(17, 24, 39, 0.95)",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#06B6D4"
                          strokeWidth={3}
                          dot={{ fill: "#06B6D4", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Customers Tab */}
            <TabsContent value="customers" className="space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Customer Analytics</CardTitle>
                  <CardDescription>
                    Customer behavior and trends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">
                      Customer Analytics
                    </h3>
                    <p className="text-muted-foreground">
                      Customer analytics data will be available soon.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
