// lib/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Helper function to generate random ID for cashier
const generateRandomId = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem("token");

// Updated apiCall function to handle empty responses
const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use default message
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content and other empty responses
    if (response.status === 204 || response.status === 205) {
      return null;
    }

    // Check if response has content
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return null;
    }

    // Parse JSON response
    return await response.json();
  } catch (error: any) {
    console.error(`API Call failed for ${url}:`, error);
    throw error;
  }
};

export const api = {
  // AUTHENTICATION
  auth: {
    checkSetup: async () => {
      return apiCall(`${API_BASE_URL}/api/auth/check-setup`);
    },

    setup: async (userData: {
      email: string;
      password: string;
      name: string;
    }) => {
      return apiCall(`${API_BASE_URL}/api/auth/setup`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },

    login: async (email: string, password: string) => {
      return apiCall(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },

    register: async (userData: {
      email: string;
      password: string;
      name: string;
      role: string;
    }) => {
      return apiCall(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },

    getMe: async () => {
      return apiCall(`${API_BASE_URL}/api/auth/me`);
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
      return apiCall(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
  },

  // USERS
  users: {
    create: async (userData: {
      email: string;
      password: string;
      name: string;
      role: string;
    }) => {
      return apiCall(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },
  },

  // CUSTOMERS
  customers: {
    getAll: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/customers`);
      return data?.data || data || [];
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/customers/${id}`);
      return data?.data || data;
    },

    create: async (data: { name: string; email?: string; phone?: string }) => {
      const result = await apiCall(`${API_BASE_URL}/api/customers`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    update: async (
      id: string,
      data: { name?: string; email?: string; phone?: string }
    ) => {
      const result = await apiCall(`${API_BASE_URL}/api/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    delete: async (id: string) => {
      return apiCall(`${API_BASE_URL}/api/customers/${id}`, {
        method: "DELETE",
      });
    },
  },

  // PRODUCTS
  products: {
    getAll: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/products`);
      return data?.data || data || [];
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/products/${id}`);
      return data?.data || data;
    },

    create: async (data: {
      name: string;
      price: number;
      stock: number;
      description?: string;
    }) => {
      const result = await apiCall(`${API_BASE_URL}/api/products`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    update: async (
      id: string,
      data: {
        name?: string;
        price?: number;
        stock?: number;
        description?: string;
      }
    ) => {
      const result = await apiCall(`${API_BASE_URL}/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    delete: async (id: string) => {
      return apiCall(`${API_BASE_URL}/api/products/${id}`, {
        method: "DELETE",
      });
    },
  },

  // ORDERS
  orders: {
    getAll: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/orders`);
      // Backend returns { orders: [], pagination: {} } structure
      return data?.orders || data?.data || data || [];
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/orders/${id}`);
      return data?.data || data;
    },

    create: async (data: {
      customerId?: string | null;
      items: Array<{ productId: string; qty: number }>;
      paymentMethod?: string;
      status?: string;
      cashierId?: string;
      paymentReference?: string;
      notes?: string;
    }) => {
      const cashierId = data.cashierId || generateRandomId();

      const result = await apiCall(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          paymentMethod: data.paymentMethod || "cash",
          status: data.status || "pending",
          cashierId: cashierId,
          paymentReference: data.paymentReference || null,
          notes: data.notes || null,
        }),
      });
      return result?.data || result;
    },

    update: async (
      id: string,
      data: {
        customerId?: string | null;
        items?: Array<{ productId: string; qty: number }>;
        paymentMethod?: string;
        status?: string;
        cashierId?: string;
        paymentReference?: string;
        notes?: string;
      }
    ) => {
      const result = await apiCall(`${API_BASE_URL}/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    delete: async (id: string) => {
      return apiCall(`${API_BASE_URL}/api/orders/${id}`, {
        method: "DELETE",
      });
    },

    updateStatus: async (id: string, status: string, reason?: string) => {
      const result = await apiCall(`${API_BASE_URL}/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      return result?.data || result;
    },

    getByStatus: async (status: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/orders/status/${status}`);
      return data?.orders || data?.data || data || [];
    },

    getTodaySummary: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/orders/summary/today`);
      return data?.data || data;
    },

    getSummaryByRange: async (startDate: string, endDate: string) => {
      const data = await apiCall(
        `${API_BASE_URL}/api/orders/summary/range?startDate=${startDate}&endDate=${endDate}`
      );
      return data?.data || data;
    },

    getPaymentMethodStats: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/orders/analytics/payment-methods`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getChannelAnalytics: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/orders/analytics/channels`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },
  },

  // REPORTS
  reports: {
    getDailySales: async (date?: string) => {
      const url = date
        ? `${API_BASE_URL}/api/reports/sales/daily?date=${date}`
        : `${API_BASE_URL}/api/reports/sales/daily`;

      const data = await apiCall(url);
      return data?.data || data;
    },

    getPaymentAnalytics: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/reports/analytics/payment`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getChannelPerformance: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/reports/analytics/channels`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getLowStock: async (threshold = 10) => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/inventory/low-stock?threshold=${threshold}`
      );
      return data?.data || data;
    },

    getCustomerHistory: async (customerId?: string, limit = 50) => {
      const url = customerId
        ? `${API_BASE_URL}/api/reports/customers/history?customerId=${customerId}&limit=${limit}`
        : `${API_BASE_URL}/api/reports/customers/history?limit=${limit}`;

      const data = await apiCall(url);
      return data?.data || data;
    },

    getSalesTrend: async (period = "weekly", weeks = 8) => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/sales/trend?period=${period}&weeks=${weeks}`
      );
      return data?.data || data;
    },

    getInventoryValuation: async () => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/inventory/valuation`
      );
      return data?.data || data;
    },

    getDashboard: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/reports/dashboard`);
      return data?.data || data;
    },

    exportReport: async (
      type: string,
      format = "json",
      params?: { startDate?: string; endDate?: string }
    ) => {
      let url = `${API_BASE_URL}/api/reports/export/${type}?format=${format}`;
      const queryParams = new URLSearchParams();

      if (params?.startDate) queryParams.append("startDate", params.startDate);
      if (params?.endDate) queryParams.append("endDate", params.endDate);

      if (queryParams.toString()) {
        url += `&${queryParams.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },
  },

  // STOCK MOVEMENTS
  stockMovements: {
    getAll: async (type?: string) => {
      const url =
        type && type !== "all"
          ? `${API_BASE_URL}/api/stock-movements?type=${type}`
          : `${API_BASE_URL}/api/stock-movements`;

      const data = await apiCall(url);
      return data || [];
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/stock-movements/${id}`);
      return data;
    },

    create: async (data: {
      productId: string;
      type: "sale" | "restock" | "adjustment" | "refund";
      quantity: number;
      reason?: string;
    }) => {
      const result = await apiCall(`${API_BASE_URL}/api/stock-movements`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result;
    },

    getReport: async () => {
      const data = await apiCall(
        `${API_BASE_URL}/api/stock-movements/report/summary`
      );
      return data;
    },

    seedSampleData: async () => {
      const result = await apiCall(
        `${API_BASE_URL}/api/stock-movements/seed-stock-data`,
        {
          method: "POST",
        }
      );
      return result;
    },

    getProductHistory: async (productId: string) => {
      const data = await apiCall(
        `${API_BASE_URL}/api/stock-movements/product/${productId}`
      );
      return data;
    },
  },

  // ANALYTICS
  analytics: {
    getPaymentMethods: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/orders/analytics/payment-methods`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getChannels: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/orders/analytics/channels`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getPaymentAnalytics: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/reports/analytics/payment`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getChannelPerformance: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/reports/analytics/channels`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data?.data || data;
    },

    getDashboard: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/reports/dashboard`);
      return data?.data || data;
    },
  },

  // PAYMENT UTILITIES
  payments: {
    getMethods: () => {
      return [
        { value: "cash", label: "Cash" },
        { value: "upi", label: "UPI" },
        { value: "card", label: "Card" },
        { value: "wallet", label: "Wallet" },
        { value: "qr", label: "QR" },
        { value: "other", label: "Other" },
      ];
    },

    getChannels: () => {
      return [
        { value: "online", label: "Online" },
        { value: "offline", label: "Offline" },
      ];
    },

    formatPaymentMethod: (method: string) => {
      const methods: Record<string, string> = {
        cash: "Cash",
        upi: "UPI",
        card: "Card",
        wallet: "Wallet",
        qr: "QR",
        other: "Other",
      };
      return methods[method] || method;
    },

    formatChannel: (channel: string) => {
      const channels: Record<string, string> = {
        online: "Online",
        offline: "Offline",
      };
      return channels[channel] || channel;
    },

    getPaymentMethodIcon: (method: string) => {
      const icons: Record<string, string> = {
        cash: "💵",
        upi: "📱",
        card: "💳",
        wallet: "👛",
        qr: "📷",
        other: "💰",
      };
      return icons[method] || "💰";
    },

    getChannelIcon: (channel: string) => {
      const icons: Record<string, string> = {
        online: "🌐",
        offline: "🏪",
      };
      return icons[channel] || "🏪";
    },
  },
};

// Debug utility
export const authDebug = {
  checkToken: () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("❌ No token found in localStorage");
      return null;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const isExpired = Date.now() >= payload.exp * 1000;

      console.log("🔐 Token Debug:");
      console.log("✅ Token exists:", token.substring(0, 20) + "...");
      console.log("👤 User ID:", payload.userId);
      console.log("🎯 Role:", payload.role);
      console.log("⏰ Issued:", new Date(payload.iat * 1000).toLocaleString());
      console.log("📅 Expires:", new Date(payload.exp * 1000).toLocaleString());
      console.log("❓ Expired:", isExpired);

      return { payload, isExpired };
    } catch (error) {
      console.log("❌ Invalid token format");
      return null;
    }
  },

  clearToken: () => {
    localStorage.removeItem("token");
    console.log("🗑️ Token cleared from localStorage");
  },

  testAPI: async () => {
    try {
      console.log("🧪 Testing API connectivity...");
      const response = await fetch(`${API_BASE_URL}/health`);
      console.log("🏥 Health check:", response.status);

      const token = localStorage.getItem("token");
      if (token) {
        const me = await api.auth.getMe();
        console.log("👤 Auth test:", me?.success ? "SUCCESS" : "FAILED");
      }
    } catch (error) {
      console.log("❌ API test failed:", error);
    }
  },

  testPaymentAnalytics: async () => {
    try {
      console.log("🧪 Testing Payment Analytics...");

      const dailySales = await api.reports.getDailySales();
      console.log("📊 Daily Sales:", {
        totalSales: dailySales?.summary?.totalSales,
        paymentSplit: dailySales?.paymentInsights?.split?.map(
          (p) => `${p.method}: ${p.percentage}%`
        ),
        channelSplit: dailySales?.channelInsights?.split?.map(
          (c) => `${c.channel}: ${c.percentage}%`
        ),
      });

      const paymentAnalytics = await api.analytics.getPaymentAnalytics();
      console.log("💰 Payment Analytics:", {
        totalOrders: paymentAnalytics?.summary?.totalOrders,
        topMethod: paymentAnalytics?.insights?.topPaymentMethod,
        onlinePercentage: paymentAnalytics?.channelSummary?.online?.percentage,
      });

      const channelAnalytics = await api.analytics.getChannels();
      console.log("📈 Channel Analytics:", {
        onlineOrders: channelAnalytics?.channels?.online?.metrics?.orderCount,
        offlineOrders: channelAnalytics?.channels?.offline?.metrics?.orderCount,
      });

      console.log("✅ Payment analytics test completed successfully");
    } catch (error) {
      console.log("❌ Payment analytics test failed:", error);
    }
  },

  testStockMovements: async () => {
    try {
      console.log("🧪 Testing Stock Movements API...");

      const movements = await api.stockMovements.getAll();
      console.log("📦 Stock Movements:", {
        count: movements?.length || 0,
        firstMovement: movements?.[0]?.id || "No movements",
      });

      const report = await api.stockMovements.getReport();
      console.log("📊 Stock Report:", {
        totalMovements: report?.totalMovements || 0,
        totalSales: report?.totalSales || 0,
        totalRestocks: report?.totalRestocks || 0,
      });

      console.log("✅ Stock movements test completed successfully");
    } catch (error) {
      console.log("❌ Stock movements test failed:", error);
    }
  },
};

// Types for TypeScript support
export type PaymentMethod = "cash" | "upi" | "card" | "wallet" | "qr" | "other";
export type ChannelType = "online" | "offline";

export interface OrderWithPayment {
  id: string;
  customerId?: string;
  total: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInsights {
  split: Array<{
    method: PaymentMethod;
    count: number;
    amount: number;
    percentage: number;
    amountPercentage: number;
  }>;
  topMethod: PaymentMethod;
  cashPercentage: number;
}

export interface ChannelInsights {
  split: Array<{
    channel: ChannelType;
    count: number;
    amount: number;
    percentage: number;
    avgOrderValue: number;
  }>;
  dominantChannel: ChannelType;
  onlinePercentage: number;
}

export interface DashboardData {
  overview: {
    today: {
      revenue: number;
      orders: number;
      avgOrder: number;
      totalItems: number;
    };
    inventory: {
      totalValue: number;
      lowStockItems: number;
      outOfStock: number;
      healthyStock: number;
    };
    payment: {
      topMethod: PaymentMethod;
      cashPercentage: number;
      upiPercentage: number;
      cardPercentage: number;
      walletPercentage: number;
      qrPercentage: number;
    };
    channels: {
      onlinePercentage: number;
      offlinePercentage: number;
      dominantChannel: ChannelType;
    };
  };
  analytics: {
    paymentSplit: Array<any>;
    channelSplit: Array<any>;
    hourlyBreakdown: Array<any>;
    salesTrend: Array<any>;
    topProducts: Array<any>;
  };
  alerts: {
    critical: Array<any>;
    paymentAlerts: Array<any>;
    channelAlerts: Array<any>;
    todayPerformance: string;
  };
  insights: {
    recommendations: Array<any>;
    opportunities: Array<any>;
    trends: {
      paymentTrend: any;
      channelTrend: {
        onlineGrowth: number;
        offlineGrowth: number;
      };
    };
  };
}

// Stock movement types
export type StockMovementType = "sale" | "restock" | "adjustment" | "refund";

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  type: StockMovementType;
  quantity: number;
  oldStock: number;
  newStock: number;
  reason?: string;
  createdAt: string;
}

export interface StockReport {
  totalMovements: number;
  totalSales: number;
  totalRestocks: number;
  totalAdjustments: number;
  totalRefunds: number;
  totalQuantitySold: number;
  totalQuantityRestocked: number;
  totalQuantityAdjusted: number;
  totalQuantityRefunded: number;
}

// Utility function to format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// Utility function to format percentage
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

// Utility function to get color based on payment method
export const getPaymentMethodColor = (method: PaymentMethod): string => {
  const colors: Record<PaymentMethod, string> = {
    cash: "#22c55e", // Green
    upi: "#3b82f6", // Blue
    card: "#8b5cf6", // Purple
    wallet: "#f59e0b", // Yellow
    qr: "#ec4899", // Pink
    other: "#6b7280", // Gray
  };
  return colors[method] || "#6b7280";
};

// Utility function to get color based on channel
export const getChannelColor = (channel: ChannelType): string => {
  const colors: Record<ChannelType, string> = {
    online: "#3b82f6", // Blue
    offline: "#22c55e", // Green
  };
  return colors[channel] || "#6b7280";
};

// Utility function to get stock movement color
export const getStockMovementColor = (type: StockMovementType): string => {
  const colors: Record<StockMovementType, string> = {
    sale: "#ef4444", // Red
    restock: "#22c55e", // Green
    adjustment: "#f59e0b", // Yellow
    refund: "#3b82f6", // Blue
  };
  return colors[type] || "#6b7280";
};
