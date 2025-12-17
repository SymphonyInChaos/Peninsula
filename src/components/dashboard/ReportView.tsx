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
  Loader2,
  RefreshCw,
  Sparkles,
  CreditCard,
  Globe,
  LineChart,
  PieChart as PieChartIcon,
  CalendarIcon,
  Download,
  TrendingDown,
  BarChart2,
  Activity,
  Target,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";

// Import the centralized API utilities
import { api, formatCurrency, formatPercentage } from "@/lib/api";
import type { DashboardData } from "@/lib/api";

// Import Recharts components
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

// Utility functions
const formatPaymentMethod = (method: string): string => {
  return api.payments.formatPaymentMethod(method);
};

const formatChannel = (channel: string): string => {
  return api.payments.formatChannel(channel);
};

// Color Schemes for Charts
const CHART_COLORS = {
  paymentMethods: {
    cash: "#f97316", // orange
    upi: "#22c55e", // green
    card: "#8b5cf6", // purple
    qr: "#ef4444", // red
    wallet: "#ec4899", // pink
    other: "#6b7280", // gray
  },
  channels: {
    online: "#3b82f6", // blue
    offline: "#f59e0b", // orange
  },
};

// Chart Components

// Sales Trend Chart Component
const SalesTrendChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground">No sales data available</p>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis 
            dataKey="period" 
            stroke="#9ca3af" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <RechartsTooltip
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid #374151',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)'
            }}
            formatter={(value) => [formatCurrency(value), 'Revenue']}
            labelFormatter={(label) => `Period: ${label}`}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="totalSales"
            stroke="#8884d8"
            fillOpacity={1}
            fill="url(#colorSales)"
            strokeWidth={3}
            name="Revenue"
            dot={{ stroke: '#8884d8', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="orderCount"
            stroke="#10b981"
            strokeWidth={2}
            name="Orders"
            strokeDasharray="5 5"
            dot={{ stroke: '#10b981', strokeWidth: 2, r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Payment Method Pie Chart
const PaymentMethodPieChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground">No payment data available</p>
      </div>
    );
  }

  const chartData = data
    .filter(item => item.percentage > 0)
    .map(item => ({
      name: formatPaymentMethod(item.method),
      value: item.percentage,
      amount: item.amount,
      color: CHART_COLORS.paymentMethods[item.method as keyof typeof CHART_COLORS.paymentMethods] || CHART_COLORS.paymentMethods.other
    }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
            outerRadius={100}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            paddingAngle={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid #374151',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)'
            }}
            formatter={(value, name, props) => {
              const item = chartData.find(d => d.name === name);
              return [
                <div key="tooltip-content">
                  <p className="font-medium">{name}</p>
                  <p className="text-sm">{formatPercentage(value)}</p>
                  <p className="text-xs text-muted-foreground">
                    Amount: {formatCurrency(item?.amount || 0)}
                  </p>
                </div>
              ];
            }}
          />
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right"
            formatter={(value, entry) => (
              <span style={{ color: entry.color }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Channel Comparison Chart
const ChannelComparisonChart = ({ 
  onlinePercentage, 
  offlinePercentage, 
  channelSplit 
}: { 
  onlinePercentage: number; 
  offlinePercentage: number; 
  channelSplit: any[] 
}) => {
  const chartData = [
    {
      name: 'Channel Distribution',
      online: onlinePercentage,
      offline: offlinePercentage,
      onlineAmount: channelSplit.find(c => c.channel === 'online')?.amount || 0,
      offlineAmount: channelSplit.find(c => c.channel === 'offline')?.amount || 0,
    }
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.2} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
          <YAxis type="category" dataKey="name" hide />
          <RechartsTooltip
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid #374151',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)'
            }}
            formatter={(value, name) => {
              const isOnline = name === 'online';
              const amount = isOnline ? chartData[0].onlineAmount : chartData[0].offlineAmount;
              return [
                <div key="tooltip-content">
                  <p className="font-medium">{isOnline ? 'Online' : 'Offline'}</p>
                  <p className="text-sm">{value}%</p>
                  <p className="text-xs text-muted-foreground">
                    Amount: {formatCurrency(amount)}
                  </p>
                </div>
              ];
            }}
          />
          <Legend />
          <Bar 
            dataKey="online" 
            fill={CHART_COLORS.channels.online} 
            name="Online" 
            radius={[0, 8, 8, 0]}
            maxBarSize={80}
          />
          <Bar 
            dataKey="offline" 
            fill={CHART_COLORS.channels.offline} 
            name="Offline" 
            radius={[0, 8, 8, 0]}
            maxBarSize={80}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Hourly Sales Chart
const HourlySalesChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground">No hourly data available</p>
      </div>
    );
  }

  const chartData = data.map(item => ({
    hour: item.hour,
    sales: item.sales,
    orders: item.orders,
    netSales: item.netSales,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis 
            dataKey="hour" 
            stroke="#9ca3af" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <RechartsTooltip
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid #374151',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)'
            }}
            formatter={(value, name) => [
              formatCurrency(value), 
              name === 'sales' ? 'Sales' : 
              name === 'netSales' ? 'Net Sales' : 
              name === 'orders' ? 'Orders' : name
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#3b82f6"
            strokeWidth={3}
            name="Total Sales"
            dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="netSales"
            stroke="#10b981"
            strokeWidth={3}
            name="Net Sales"
            strokeDasharray="5 5"
            dot={{ stroke: '#10b981', strokeWidth: 2, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="orders"
            stroke="#ec4899"
            strokeWidth={2}
            name="Orders"
            dot={{ stroke: '#ec4899', strokeWidth: 2, r: 3 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Performance Radar Chart
const PerformanceRadarChart = ({ data }: { data: any[] }) => {
  if (!data || data.length < 3) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground">Insufficient data for performance chart</p>
      </div>
    );
  }

  // Take last 4 periods for comparison
  const recentData = data.slice(-4);
  const chartData = recentData.map((item, index) => ({
    subject: item.period,
    Revenue: item.totalSales / 1000, // Scale down for better visualization
    Orders: item.orderCount,
    'Avg Order': item.avgOrderValue,
    fullMark: Math.max(
      ...recentData.map(d => Math.max(d.totalSales/1000, d.orderCount, d.avgOrderValue))
    ),
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="#374151" opacity={0.3} />
          <PolarAngleAxis dataKey="subject" stroke="#9ca3af" fontSize={12} />
          <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} stroke="#9ca3af" />
          <RechartsTooltip
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid #374151',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)'
            }}
            formatter={(value, name) => [
              name === 'Revenue' ? formatCurrency(value * 1000) :
              name === 'Avg Order' ? formatCurrency(value) :
              value,
              name
            ]}
          />
          <Radar
            name="Revenue (in thousands)"
            dataKey="Revenue"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <Radar
            name="Order Count"
            dataKey="Orders"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <Radar
            name="Average Order Value"
            dataKey="Avg Order"
            stroke="#ec4899"
            fill="#ec4899"
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Revenue vs Orders Comparison Chart
const RevenueOrdersChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(-7)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="period" stroke="#9ca3af" fontSize={12} />
          <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} />
          <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} />
          <RechartsTooltip
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            formatter={(value, name) => [
              name === 'Revenue' ? formatCurrency(value) : value,
              name
            ]}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="totalSales" fill="#8884d8" name="Revenue" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="orderCount" fill="#10b981" name="Orders" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Main ReportView Component
export default function ReportView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState<string>("daily-sales");
  const [exportLoading, setExportLoading] = useState(false);

  // Fetch dashboard data on mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch specific report data when date or date range changes
  useEffect(() => {
    if (activeTab === "reports") {
      fetchSpecificReport();
    }
  }, [selectedDate, dateRange, reportType, activeTab]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please login.");
        setLoading(false);
        return;
      }

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
              topMethod: data.overview?.payment?.topMethod || "card",
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
              dominantChannel: data.overview?.channels?.dominantChannel || "online",
            },
          },
          analytics: {
            paymentSplit: data.analytics?.paymentSplit?.map((item: any) => ({
              method: item.method,
              count: item.count || 0,
              amount: item.amount || 0,
              percentage: item.percentage || Math.abs(item.amountPercentage) || 0,
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
            salesTrend: data.analytics?.salesTrend?.map((item: any, index: number) => {
              let period = item.period || `Week ${index + 1}`;
              const weekMatch = period.match(/W(\d+)$/);
              if (weekMatch) {
                period = `Week ${weekMatch[1]}`;
              }
              
              return {
                period: period,
                totalSales: item.netSales || item.totalSales || 0,
                orderCount: item.orders || item.orderCount || 0,
                avgOrderValue: item.avgOrderValue || 0,
              };
            }) || [],
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
      } else {
        throw new Error("No data returned from API");
      }
    } catch (error) {
      console.error("[ReportView] Error fetching dashboard:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load dashboard data";
      setError(errorMessage);
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecificReport = async () => {
    try {
      setLoading(true);
      
      let response;
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const formattedStartDate = format(dateRange.start, "yyyy-MM-dd");
      const formattedEndDate = format(dateRange.end, "yyyy-MM-dd");
      
      console.log(`[ReportView] Fetching ${reportType} report:`, {
        date: formattedDate,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });
      
      switch (reportType) {
        case "daily-sales":
          response = await api.reports.getDailySales(formattedDate);
          break;
        case "payment-analytics":
          response = await api.reports.getPaymentAnalytics(formattedStartDate, formattedEndDate);
          break;
        case "channel-performance":
          response = await api.reports.getChannelPerformance(formattedStartDate, formattedEndDate);
          break;
        case "inventory":
          response = await api.reports.getLowStock(10);
          break;
        case "sales-trend":
          response = await api.reports.getSalesTrend("weekly", 8);
          break;
        case "inventory-valuation":
          response = await api.reports.getInventoryValuation();
          break;
        default:
          response = await api.reports.getDailySales(formattedDate);
      }
      
      if (response) {
        console.log(`[ReportView] ${reportType} report received:`, response);
        setReportData(response);
        setError(null);
      } else {
        setError("No report data available");
        setReportData(null);
      }
    } catch (error) {
      console.error("[ReportView] Error fetching report:", error);
      setError("Failed to fetch report data");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      // Automatically fetch daily sales report for selected date
      setReportType("daily-sales");
      // Switch to reports tab to show the data
      setActiveTab("reports");
      
      console.log("[ReportView] Date selected:", format(date, "yyyy-MM-dd"));
    }
  };

  const handleReportTypeChange = (type: string) => {
    setReportType(type);
    console.log("[ReportView] Report type changed to:", type);
  };

  const exportReport = async (type: string, format = "csv") => {
    try {
      setExportLoading(true);
      
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

      console.log("[ReportView] Exporting report:", { type, format, params });

      // Use the centralized API for export
      const data = await api.reports.exportReport(type, format, params);
      
      if (data && data.url) {
        window.open(data.url, '_blank');
      } else if (data && data.data) {
        // For CSV/Excel formats, create a download link
        const blob = new Blob([data.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-report-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError("Export failed: No data returned");
      }
    } catch (error) {
      console.error("[ReportView] Export error:", error);
      setError("Failed to export report");
    } finally {
      setExportLoading(false);
    }
  };

  const renderReportContent = () => {
    if (!reportData) {
      return (
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No report data available</p>
            <p className="text-sm text-muted-foreground">
              Select a date and report type to view data
            </p>
          </div>
        </div>
      );
    }

    switch (reportType) {
      case "daily-sales":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData?.summary?.totalOrders || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Net Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reportData?.summary?.netRevenue || 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reportData?.summary?.avgOrderValue || 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData?.summary?.totalItems || 0}</div>
                </CardContent>
              </Card>
            </div>

            {reportData.paymentInsights?.split && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method Distribution</CardTitle>
                  <CardDescription>How customers paid on {format(selectedDate, "MMMM dd, yyyy")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.paymentInsights.split.filter((item: any) => item.percentage > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ method, percentage }) => `${formatPaymentMethod(method)}: ${percentage.toFixed(1)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="percentage"
                        >
                          {reportData.paymentInsights.split.filter((item: any) => item.percentage > 0).map((entry: any, index: number) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CHART_COLORS.paymentMethods[entry.method as keyof typeof CHART_COLORS.paymentMethods] || CHART_COLORS.paymentMethods.other} 
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value, name, props) => {
                            const item = reportData.paymentInsights.split.find((p: any) => p.method === props.payload.method);
                            return [
                              <div key="tooltip-content">
                                <p className="font-medium">{formatPaymentMethod(props.payload.method)}</p>
                                <p className="text-sm">{value}%</p>
                                <p className="text-xs text-muted-foreground">
                                  Amount: {formatCurrency(item?.amount || 0)}
                                </p>
                              </div>
                            ];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {reportData.channelInsights?.split && (
              <Card>
                <CardHeader>
                  <CardTitle>Channel Distribution</CardTitle>
                  <CardDescription>Online vs Offline sales</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.channelInsights.split} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis dataKey="channel" tickFormatter={(value) => formatChannel(value)} />
                        <YAxis />
                        <RechartsTooltip
                          formatter={(value, name, props) => [
                            name === 'amount' ? formatCurrency(value) : value,
                            name === 'amount' ? 'Amount' : name === 'count' ? 'Orders' : name
                          ]}
                        />
                        <Bar dataKey="amount" fill="#8884d8" name="Revenue" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="count" fill="#10b981" name="Orders" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "payment-analytics":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Analytics Summary</CardTitle>
                <CardDescription>
                  {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{reportData?.summary?.totalOrders || 0}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Net Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(reportData?.summary?.netRevenue || 0)}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Refund Rate</p>
                    <p className="text-2xl font-bold">{reportData?.summary?.refundRate?.toFixed(1) || 0}%</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Avg Order Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(reportData?.summary?.avgOrderValue || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {reportData.paymentSummary && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(reportData.paymentSummary).map(([method, data]: [string, any]) => (
                      <div key={method} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{formatPaymentMethod(method)}</span>
                          <span className="font-bold">{data.percentage?.toFixed(1) || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full"
                            style={{ 
                              width: `${data.percentage || 0}%`,
                              backgroundColor: CHART_COLORS.paymentMethods[method as keyof typeof CHART_COLORS.paymentMethods] || CHART_COLORS.paymentMethods.other
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Orders: {data.orders || 0}</span>
                          <span>Revenue: {formatCurrency(data.netRevenue || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "channel-performance":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Channel Performance Summary</CardTitle>
                <CardDescription>
                  {format(dateRange.start, "MMM dd, yyyy")} - {format(dateRange.end, "MMM dd, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{reportData?.summary?.totalOrders || 0}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Online %</p>
                    <p className="text-2xl font-bold">{reportData?.summary?.onlinePercentage?.toFixed(1) || 0}%</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Online Growth</p>
                    <p className="text-2xl font-bold">{reportData?.summary?.onlineGrowth?.toFixed(1) || 0}%</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Offline Growth</p>
                    <p className="text-2xl font-bold">{reportData?.summary?.offlineGrowth?.toFixed(1) || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>{reportType.replace("-", " ").toUpperCase()} Report</CardTitle>
              <CardDescription>
                {reportType === "daily-sales" 
                  ? `Date: ${format(selectedDate, "MMMM dd, yyyy")}`
                  : `Date Range: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(reportData, null, 2)}
                </pre>
                <p className="text-sm text-muted-foreground">
                  Raw report data for {reportType.replace("-", " ")}
                </p>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  // Calculate stats from actual data or show 0 if no data
  const todayStats = dashboardData?.overview?.today || {
    revenue: 0,
    orders: 0,
    avgOrder: 0,
    totalItems: 0,
    netRevenue: 0
  };

  const stats = [
    {
      title: "Today's Revenue",
      value: formatCurrency(todayStats.revenue),
      icon: DollarSign,
      gradient: "from-purple-500 to-pink-600",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      title: "Orders Today",
      value: todayStats.orders,
      icon: ShoppingCart,
      gradient: "from-blue-500 to-cyan-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      title: "Inventory Value",
      value: formatCurrency(dashboardData?.overview?.inventory?.totalValue || 0),
      icon: Package,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      title: "Low Stock Items",
      value: dashboardData?.overview?.inventory?.lowStockItems || 0,
      icon: AlertTriangle,
      gradient: "from-amber-500 to-orange-600",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
  ];

  const paymentStats = [
    {
      title: "Top Payment Method",
      value: formatPaymentMethod(dashboardData?.overview?.payment?.topMethod || "card"),
      icon: CreditCard,
      color: CHART_COLORS.paymentMethods.card,
      percentage: dashboardData?.overview?.payment?.cardPercentage || 0,
    },
    {
      title: "Digital Adoption",
      value: formatPercentage(dashboardData?.overview?.payment?.digitalAdoption || 0),
      icon: CreditCard,
      color: "#3b82f6",
      percentage: dashboardData?.overview?.payment?.digitalAdoption || 0,
    },
    {
      title: "Online Orders",
      value: formatPercentage(dashboardData?.overview?.channels?.onlinePercentage || 0),
      icon: Globe,
      color: CHART_COLORS.channels.online,
      percentage: dashboardData?.overview?.channels?.onlinePercentage || 0,
    },
    {
      title: "Dominant Channel",
      value: formatChannel(dashboardData?.overview?.channels?.dominantChannel || "online"),
      icon: Globe,
      color: CHART_COLORS.channels.online,
      percentage: dashboardData?.overview?.channels?.dominantChannel === "online"
        ? dashboardData?.overview?.channels?.onlinePercentage || 0
        : 100 - (dashboardData?.overview?.channels?.onlinePercentage || 0),
    },
  ];

  if (loading && !reportData) {
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

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Unable to Load Dashboard</h2>
          <p className="text-muted-foreground mb-6">
            {error || "No data available. Please check your connection and try again."}
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={fetchDashboardData} variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/login'}>
              Login
            </Button>
          </div>
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
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Today: {format(new Date(), "MMM dd, yyyy")}
                  </span>
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
                      {format(selectedDate, "MMM dd, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      initialFocus
                      className="rounded-md border"
                    />
                  </PopoverContent>
                </Popover>
                
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
              <div className="flex gap-2">
                <Button
                  onClick={() => exportReport("daily-sales", "csv")}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={exportLoading}
                >
                  {exportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
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
                      <div className="space-y-4">
                        {dashboardData.analytics.salesTrend && dashboardData.analytics.salesTrend.length > 0 ? (
                          dashboardData.analytics.salesTrend.map((item: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium">{item.period}</p>
                                <p className="text-sm text-muted-foreground">{item.orderCount} orders</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{formatCurrency(item.totalSales)}</p>
                                <p className="text-sm text-muted-foreground">Avg: {formatCurrency(item.avgOrderValue)}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-80 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-muted-foreground">No sales trend data available</p>
                              <Button 
                                variant="outline" 
                                className="mt-4"
                                onClick={fetchDashboardData}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh Data
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
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
                    <CardContent>
                      <div className="space-y-4">
                        {dashboardData.analytics.topProducts && dashboardData.analytics.topProducts.length > 0 ? (
                          dashboardData.analytics.topProducts.map((product: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="font-bold text-primary">{index + 1}</span>
                                </div>
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-sm text-muted-foreground">{product.quantity} units sold</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{formatCurrency(product.revenue)}</p>
                                <p className="text-sm text-muted-foreground">
                                  Avg: {formatCurrency(product.revenue / (product.quantity || 1))}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-80 flex items-center justify-center">
                            <p className="text-muted-foreground">No product data available</p>
                          </div>
                        )}
                      </div>
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
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                      Payment Method Distribution
                    </CardTitle>
                    <CardDescription>
                      How customers are paying
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.analytics.paymentSplit && dashboardData.analytics.paymentSplit.length > 0 ? (
                        dashboardData.analytics.paymentSplit
                          .filter((item: any) => item.percentage > 0)
                          .map((payment: any, index: number) => (
                            <div key={index} className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium">{formatPaymentMethod(payment.method)}</span>
                                <span className="font-bold">{formatCurrency(payment.amount)} ({payment.percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full"
                                  style={{ 
                                    width: `${payment.percentage}%`,
                                    backgroundColor: CHART_COLORS.paymentMethods[payment.method as keyof typeof CHART_COLORS.paymentMethods] || CHART_COLORS.paymentMethods.other
                                  }}
                                />
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-muted-foreground">No payment data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-blue-500" />
                          Sales Trend Analysis
                        </CardTitle>
                        <CardDescription>
                          Revenue and order trends over time
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportReport("sales-trend", "csv")}>
                          <Download className="w-4 h-4 mr-2" />
                          Export CSV
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setReportType("sales-trend");
                            fetchSpecificReport();
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SalesTrendChart data={dashboardData.analytics.salesTrend} />
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-purple-500" />
                        Payment Method Distribution
                      </CardTitle>
                      <CardDescription>
                        How customers prefer to pay
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PaymentMethodPieChart data={dashboardData.analytics.paymentSplit} />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-green-500" />
                        Channel Performance
                      </CardTitle>
                      <CardDescription>
                        Online vs. Offline sales comparison
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChannelComparisonChart
                        onlinePercentage={dashboardData.overview.channels.onlinePercentage}
                        offlinePercentage={dashboardData.overview.channels.offlinePercentage}
                        channelSplit={dashboardData.analytics.channelSplit}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-amber-500" />
                        Hourly Sales Pattern
                      </CardTitle>
                      <CardDescription>
                        Sales distribution throughout the day
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <HourlySalesChart data={dashboardData.analytics.hourlyBreakdown} />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-pink-500" />
                        Performance Metrics
                      </CardTitle>
                      <CardDescription>
                        Multi-dimensional performance analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PerformanceRadarChart data={dashboardData.analytics.salesTrend} />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      Detailed Sales Statistics
                    </CardTitle>
                    <CardDescription>
                      Comprehensive breakdown of sales metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Revenue Metrics</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Total Revenue</span>
                            <span className="font-bold">{formatCurrency(dashboardData.overview.today.revenue)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Net Revenue</span>
                            <span className="font-bold">{formatCurrency(dashboardData.overview.today.netRevenue)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Avg Order Value</span>
                            <span className="font-bold">{formatCurrency(dashboardData.overview.today.avgOrder)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Order Metrics</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Total Orders</span>
                            <span className="font-bold">{dashboardData.overview.today.orders}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Items Sold</span>
                            <span className="font-bold">{dashboardData.overview.today.totalItems}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Conversion Rate</span>
                            <span className="font-bold">
                              {dashboardData.overview.today.orders > 0 ? 
                                ((dashboardData.overview.today.orders / Math.max(1, dashboardData.overview.today.totalItems)) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Channel Performance</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.channels.online }} />
                              <span className="text-sm">Online</span>
                            </div>
                            <span className="font-bold">{formatPercentage(dashboardData.overview.channels.onlinePercentage)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.channels.offline }} />
                              <span className="text-sm">Offline</span>
                            </div>
                            <span className="font-bold">{formatPercentage(dashboardData.overview.channels.offlinePercentage)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                            <span className="text-sm">Dominant Channel</span>
                            <span className="font-bold capitalize">{dashboardData.overview.channels.dominantChannel}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        Revenue vs Orders Comparison
                      </CardTitle>
                      <CardDescription>
                        Daily sales and order correlation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RevenueOrdersChart data={dashboardData.analytics.salesTrend} />
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-rose-500" />
                        Top Products Revenue Share
                      </CardTitle>
                      <CardDescription>
                        Contribution of top 5 products
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={dashboardData.analytics.topProducts.slice(0, 5)}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="revenue"
                            >
                              {dashboardData.analytics.topProducts.slice(0, 5).map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe'][index % 5]} 
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value) => [formatCurrency(value), 'Revenue']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      Growth Analysis
                    </CardTitle>
                    <CardDescription>
                      Week-over-week performance metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {dashboardData.analytics.salesTrend.slice(-4).map((week, index, array) => {
                          const previousWeek = array[index - 1];
                          const revenueGrowth = previousWeek ? 
                            ((week.totalSales - previousWeek.totalSales) / previousWeek.totalSales * 100) : 0;
                          const orderGrowth = previousWeek ? 
                            ((week.orderCount - previousWeek.orderCount) / previousWeek.orderCount * 100) : 0;
                          
                          return (
                            <div key={week.period} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                <h4 className="font-medium">{week.period}</h4>
                                <div className={`flex items-center ${revenueGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                                  <span className="text-sm font-medium">{revenueGrowth.toFixed(1)}%</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-sm text-muted-foreground">Revenue</p>
                                  <p className="font-bold">{formatCurrency(week.totalSales)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Orders</p>
                                  <p className="font-bold">{week.orderCount}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {orderGrowth >= 0 ? '+' : ''}{orderGrowth.toFixed(1)}% from previous
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-blue-500" />
                      Report Viewer
                    </CardTitle>
                    <CardDescription>
                      View and export detailed reports for selected dates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Report Type Selector */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        <Button
                          variant={reportType === "daily-sales" ? "default" : "outline"}
                          onClick={() => handleReportTypeChange("daily-sales")}
                          size="sm"
                        >
                          Daily Sales
                        </Button>
                        <Button
                          variant={reportType === "payment-analytics" ? "default" : "outline"}
                          onClick={() => handleReportTypeChange("payment-analytics")}
                          size="sm"
                        >
                          Payment Analytics
                        </Button>
                        <Button
                          variant={reportType === "channel-performance" ? "default" : "outline"}
                          onClick={() => handleReportTypeChange("channel-performance")}
                          size="sm"
                        >
                          Channel Performance
                        </Button>
                        <Button
                          variant={reportType === "inventory" ? "default" : "outline"}
                          onClick={() => handleReportTypeChange("inventory")}
                          size="sm"
                        >
                          Inventory
                        </Button>
                        <Button
                          variant={reportType === "sales-trend" ? "default" : "outline"}
                          onClick={() => handleReportTypeChange("sales-trend")}
                          size="sm"
                        >
                          Sales Trend
                        </Button>
                        <Button
                          variant={reportType === "inventory-valuation" ? "default" : "outline"}
                          onClick={() => handleReportTypeChange("inventory-valuation")}
                          size="sm"
                        >
                          Inventory Valuation
                        </Button>
                      </div>

                      {/* Date Information */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-medium mb-2">Report Parameters</h3>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {reportType === "daily-sales" ? (
                                <>
                                  <p>Date: {format(selectedDate, "MMMM dd, yyyy")}</p>
                                  <p>Report Type: Daily Sales Report</p>
                                </>
                              ) : reportType === "inventory" || reportType === "inventory-valuation" ? (
                                <>
                                  <p>Date: Current Inventory</p>
                                  <p>Report Type: {reportType.replace("-", " ").toUpperCase()}</p>
                                </>
                              ) : (
                                <>
                                  <p>Date Range: {format(dateRange.start, "MMM dd, yyyy")} to {format(dateRange.end, "MMM dd, yyyy")}</p>
                                  <p>Report Type: {reportType.replace("-", " ").toUpperCase()}</p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => fetchSpecificReport()}
                              variant="outline"
                              size="sm"
                              disabled={loading}
                            >
                              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                              Refresh Report
                            </Button>
                            <Button
                              onClick={() => exportReport(reportType, "csv")}
                              variant="default"
                              size="sm"
                              disabled={exportLoading}
                            >
                              {exportLoading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4 mr-2" />
                              )}
                              Export CSV
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Report Content */}
                      {loading ? (
                        <div className="h-96 flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                            <p className="text-muted-foreground">Loading report data...</p>
                          </div>
                        </div>
                      ) : error ? (
                        <div className="h-96 flex items-center justify-center">
                          <div className="text-center">
                            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                            <p className="text-muted-foreground">{error}</p>
                            <Button
                              onClick={fetchSpecificReport}
                              variant="outline"
                              className="mt-4"
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      ) : (
                        renderReportContent()
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <Card className="border-border/50 hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="w-5 h-5 text-blue-500" />
                      Quick Export
                    </CardTitle>
                    <CardDescription>
                      Download reports in various formats
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Button
                        onClick={() => exportReport("daily-sales", "csv")}
                        variant="outline"
                        className="h-auto p-4 flex-col items-start justify-start"
                        disabled={exportLoading}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-medium">Daily Sales CSV</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">
                          {format(selectedDate, "MMM dd, yyyy")}
                        </p>
                      </Button>
                      <Button
                        onClick={() => exportReport("payment-analytics", "csv")}
                        variant="outline"
                        className="h-auto p-4 flex-col items-start justify-start"
                        disabled={exportLoading}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4" />
                          <span className="font-medium">Payment Analytics CSV</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">
                          {format(dateRange.start, "MMM dd")} - {format(dateRange.end, "MMM dd")}
                        </p>
                      </Button>
                      <Button
                        onClick={() => exportReport("channel-performance", "csv")}
                        variant="outline"
                        className="h-auto p-4 flex-col items-start justify-start"
                        disabled={exportLoading}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="w-4 h-4" />
                          <span className="font-medium">Channel Performance CSV</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">
                          {format(dateRange.start, "MMM dd")} - {format(dateRange.end, "MMM dd")}
                        </p>
                      </Button>
                      <Button
                        onClick={() => exportReport("sales-trend", "csv")}
                        variant="outline"
                        className="h-auto p-4 flex-col items-start justify-start"
                        disabled={exportLoading}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-medium">Sales Trend CSV</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">
                          Last 8 weeks data
                        </p>
                      </Button>
                      <Button
                        onClick={() => exportReport("inventory", "csv")}
                        variant="outline"
                        className="h-auto p-4 flex-col items-start justify-start"
                        disabled={exportLoading}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4" />
                          <span className="font-medium">Inventory Report CSV</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">
                          Low stock items and alerts
                        </p>
                      </Button>
                      <Button
                        onClick={() => exportReport("inventory-valuation", "csv")}
                        variant="outline"
                        className="h-auto p-4 flex-col items-start justify-start"
                        disabled={exportLoading}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-medium">Inventory Valuation CSV</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-left">
                          Stock value and profitability
                        </p>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Footer with Data Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center text-sm text-muted-foreground border-t pt-6"
        >
          <p>
            Dashboard data last updated: {new Date().toLocaleTimeString()} • Showing data for{" "}
            {dateRange.start.toLocaleDateString()} to {dateRange.end.toLocaleDateString()}
          </p>
          <p className="mt-2 text-xs">
            {activeTab === "reports" && reportData 
              ? `${reportType.replace("-", " ")} report loaded for ${reportType === "daily-sales" ? format(selectedDate, "MMMM dd, yyyy") : format(dateRange.start, "MMM dd, yyyy") + " to " + format(dateRange.end, "MMM dd, yyyy")}`
              : `Sales trend data: ${dashboardData.analytics.salesTrend?.length || 0} periods available`
            }
          </p>
        </motion.div>
      </main>
    </div>
  );
}