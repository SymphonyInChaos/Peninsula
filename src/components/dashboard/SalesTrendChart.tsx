// Update the imports section
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
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
  import {
    TrendingUp,
    TrendingDown,
    BarChart2,
    Activity,
    PieChart as PieChartIcon,
    Target,
  } from "lucide-react";
  
  // Add these custom chart components in your ReportView component
  
  // Sales Trend Chart Component
  const SalesTrendChart = ({ data }) => {
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
            <Tooltip
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
  const PaymentMethodPieChart = ({ data }) => {
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
        color: CHART_COLORS.paymentMethods[item.method] || CHART_COLORS.paymentMethods.other
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
            <Tooltip
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
  const ChannelComparisonChart = ({ onlinePercentage, offlinePercentage, channelSplit }) => {
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
            <Tooltip
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
  const HourlySalesChart = ({ data }) => {
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
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
            <Tooltip
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };
  
  // Performance Radar Chart
  const PerformanceRadarChart = ({ salesTrend }) => {
    if (!salesTrend || salesTrend.length < 3) {
      return (
        <div className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground">Insufficient data for performance chart</p>
        </div>
      );
    }
  
    // Take last 4 periods for comparison
    const recentData = salesTrend.slice(-4);
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
            <Tooltip
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