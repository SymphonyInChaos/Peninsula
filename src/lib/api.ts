// lib/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem("token");

// Helper function for API calls
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
      const errorData = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(
        errorData.message || `Request failed with status ${response.status}`
      );
    }

    return response.json();
  } catch (error: any) {
    console.error(`API Call failed for ${url}:`, error);
    throw error;
  }
};

export const api = {
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

  customers: {
    getAll: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/customers`);
      return data.data || data;
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/customers/${id}`);
      return data.data || data;
    },

    create: async (data: { name: string; email?: string; phone?: string }) => {
      const result = await apiCall(`${API_BASE_URL}/api/customers`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result.data || result;
    },

    update: async (
      id: string,
      data: { name?: string; email?: string; phone?: string }
    ) => {
      const result = await apiCall(`${API_BASE_URL}/api/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result.data || result;
    },

    delete: async (id: string) => {
      return apiCall(`${API_BASE_URL}/api/customers/${id}`, {
        method: "DELETE",
      });
    },
  },

  products: {
    getAll: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/products`);
      return data.data || data;
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/products/${id}`);
      return data.data || data;
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
      return result.data || result;
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
      return result.data || result;
    },

    delete: async (id: string) => {
      return apiCall(`${API_BASE_URL}/api/products/${id}`, {
        method: "DELETE",
      });
    },
  },

  orders: {
    getAll: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/orders`);
      return data.data || data;
    },

    getById: async (id: string) => {
      const data = await apiCall(`${API_BASE_URL}/api/orders/${id}`);
      return data.data || data;
    },

    create: async (data: {
      customerId?: string | null;
      items: Array<{ productId: string; qty: number }>;
      paymentMethod?: string;
    }) => {
      const result = await apiCall(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          paymentMethod: data.paymentMethod || "cash",
        }),
      });
      return result.data || result;
    },

    update: async (
      id: string,
      data: {
        customerId?: string | null;
        items?: Array<{ productId: string; qty: number }>;
        paymentMethod?: string;
      }
    ) => {
      const result = await apiCall(`${API_BASE_URL}/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result.data || result;
    },

    delete: async (id: string) => {
      return apiCall(`${API_BASE_URL}/api/orders/${id}`, {
        method: "DELETE",
      });
    },

    // NEW: Get payment method statistics
    getPaymentMethodStats: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/orders/analytics/payment-methods`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data.data || data;
    },

    // NEW: Get channel analytics
    getChannelAnalytics: async (startDate?: string, endDate?: string) => {
      let url = `${API_BASE_URL}/api/orders/analytics/channels`;
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await apiCall(url);
      return data.data || data;
    },
  },

  reports: {
    getDailySales: async (date?: string) => {
      const url = date
        ? `${API_BASE_URL}/api/reports/sales/daily?date=${date}`
        : `${API_BASE_URL}/api/reports/sales/daily`;

      const data = await apiCall(url);
      return data.data || data;
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
      return data.data || data;
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
      return data.data || data;
    },

    getLowStock: async (threshold = 10) => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/inventory/low-stock?threshold=${threshold}`
      );
      return data.data || data;
    },

    getCustomerHistory: async (customerId?: string, limit = 50) => {
      const url = customerId
        ? `${API_BASE_URL}/api/reports/customers/history?customerId=${customerId}&limit=${limit}`
        : `${API_BASE_URL}/api/reports/customers/history?limit=${limit}`;

      const data = await apiCall(url);
      return data.data || data;
    },

    getSalesTrend: async (period = "weekly", weeks = 8) => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/sales/trend?period=${period}&weeks=${weeks}`
      );
      return data.data || data;
    },

    getInventoryValuation: async () => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/inventory/valuation`
      );
      return data.data || data;
    },

    getDashboard: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/reports/dashboard`);
      return data.data || data;
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
      return data.data || data;
    },
  },

  // NEW: Analytics namespace for easy access
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
      return data.data || data;
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
      return data.data || data;
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
      return data.data || data;
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
      return data.data || data;
    },

    getDashboard: async () => {
      const data = await apiCall(`${API_BASE_URL}/api/reports/dashboard`);
      return data.data || data;
    },
  },

  // NEW: Payment utilities
  payments: {
    getMethods: () => {
      return [
        { value: "cash", label: "Cash" },
        { value: "upi", label: "UPI" },
        { value: "card", label: "Card" },
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
        console.log("👤 Auth test:", me.success ? "SUCCESS" : "FAILED");
      }
    } catch (error) {
      console.log("❌ API test failed:", error);
    }
  },

  // NEW: Test payment analytics
  testPaymentAnalytics: async () => {
    try {
      console.log("🧪 Testing Payment Analytics...");

      // Test daily sales report
      const dailySales = await api.reports.getDailySales();
      console.log("📊 Daily Sales:", {
        totalSales: dailySales.summary?.totalSales,
        paymentSplit: dailySales.paymentInsights?.split?.map(
          (p) => `${p.method}: ${p.percentage}%`
        ),
        channelSplit: dailySales.channelInsights?.split?.map(
          (c) => `${c.channel}: ${c.percentage}%`
        ),
      });

      // Test payment analytics
      const paymentAnalytics = await api.analytics.getPaymentAnalytics();
      console.log("💰 Payment Analytics:", {
        totalOrders: paymentAnalytics.summary?.totalOrders,
        topMethod: paymentAnalytics.insights?.topPaymentMethod,
        onlinePercentage: paymentAnalytics.channelSummary?.online?.percentage,
      });

      // Test channel analytics
      const channelAnalytics = await api.analytics.getChannels();
      console.log("📈 Channel Analytics:", {
        onlineOrders: channelAnalytics.channels?.online?.metrics?.orderCount,
        offlineOrders: channelAnalytics.channels?.offline?.metrics?.orderCount,
      });

      console.log("✅ Payment analytics test completed successfully");
    } catch (error) {
      console.log("❌ Payment analytics test failed:", error);
    }
  },
};

// Types for TypeScript support
export type PaymentMethod = "cash" | "upi" | "card" | "other";
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
