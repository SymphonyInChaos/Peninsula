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
const getAuthToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("⚠️ No token found in localStorage");
      return null;
    }
    
    // Validate token format
    if (typeof token !== 'string') {
      console.error("❌ Token is not a string");
      localStorage.removeItem("token");
      return null;
    }
    
    // Check if it looks like a JWT token
    if (!token.includes('.') || token.split('.').length !== 3) {
      console.error("❌ Token doesn't look like a valid JWT");
      localStorage.removeItem("token");
      return null;
    }
    
    return token;
  } catch (error) {
    console.error("❌ Error getting token:", error);
    return null;
  }
};

// Updated apiCall function with better error handling and debugging
const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  // Debug logging
  console.group(`📡 API Call: ${url}`);
  console.log(`🔐 Token available: ${!!token}`);
  console.log(`⚙️ Method: ${options.method || 'GET'}`);
  
  // Create headers object properly
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  // Always add Authorization if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log(`✅ Added Authorization header`);
  } else {
    console.warn(`⚠️ No token found for authenticated endpoint: ${url}`);
  }
  
  // Merge with any headers from options
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  
  const config = {
    ...options,
    headers,
  };

  console.log(`📋 Final headers:`, headers);
  
  try {
    console.log(`➡️ Sending request to: ${url}`);
    const response = await fetch(url, config);
    
    console.log(`⬅️ Response status: ${response.status} ${response.statusText}`);
    console.log(`📦 Response headers:`, Object.fromEntries(response.headers.entries()));

    // Handle 204 No Content and other empty responses
    if (response.status === 204 || response.status === 205) {
      console.groupEnd();
      return null;
    }

    // Check if response has content
    const contentType = response.headers.get("content-type");

    // Try to parse JSON response, even for error statuses
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();

      if (!response.ok) {
        // Extract error message from JSON response
        const errorMessage =
          data.message ||
          data.error ||
          `HTTP error! status: ${response.status}`;
        console.error(`❌ API Error: ${errorMessage}`);
        
        // Auto-logout on 401 Unauthorized
        if (response.status === 401) {
          console.log("🔒 401 Unauthorized - Clearing token");
          localStorage.removeItem("token");
          // Optional: redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        
        console.groupEnd();
        throw new Error(errorMessage);
      }

      console.log(`✅ API Success: ${url}`);
      console.log(`📊 Response data:`, data);
      console.groupEnd();
      return data;
    }

    // For non-JSON responses, check status
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Non-JSON error: ${errorText}`);
      console.groupEnd();
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // For empty non-JSON responses
    console.groupEnd();
    return null;
  } catch (error: any) {
    console.error(`❌ API Call failed for ${url}:`, error);
    console.groupEnd();
    throw error;
  }
};

export const api = {
  // AUTHENTICATION
  auth: {
    checkSetup: async () => {
      console.log("🔍 Checking system setup...");
      return apiCall(`${API_BASE_URL}/api/auth/check-setup`);
    },

    setup: async (userData: {
      email: string;
      password: string;
      name: string;
    }) => {
      console.log("🔧 Setting up system...");
      return apiCall(`${API_BASE_URL}/api/auth/setup`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },

    login: async (email: string, password: string) => {
      console.log("🔑 Attempting login...");
      const data = await apiCall(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // Store token if provided
      if (data?.token) {
        localStorage.setItem("token", data.token);
        console.log("✅ Token stored in localStorage");
      } else {
        console.warn("⚠️ No token in login response");
      }

      return data;
    },

    register: async (userData: {
      email: string;
      password: string;
      name: string;
      role: string;
    }) => {
      console.log("📝 Registering user...");
      return apiCall(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },

    getMe: async () => {
      console.log("👤 Getting current user...");
      return apiCall(`${API_BASE_URL}/api/auth/me`);
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
      console.log("🔐 Changing password...");
      return apiCall(`${API_BASE_URL}/api/auth/change-password`, {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    logout: () => {
      console.log("🚪 Logging out...");
      localStorage.removeItem("token");
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
      console.log("👥 Creating user...");
      return apiCall(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },
  },

  // CUSTOMERS
  customers: {
    getAll: async () => {
      console.log("📋 Getting all customers...");
      const data = await apiCall(`${API_BASE_URL}/api/customers`);
      return data?.data || data || [];
    },

    getById: async (id: string) => {
      console.log(`👤 Getting customer ${id}...`);
      const data = await apiCall(`${API_BASE_URL}/api/customers/${id}`);
      return data?.data || data;
    },

    create: async (data: { name: string; email?: string; phone?: string }) => {
      console.log("➕ Creating customer...");
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
      console.log(`✏️ Updating customer ${id}...`);
      const result = await apiCall(`${API_BASE_URL}/api/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    delete: async (id: string) => {
      console.log(`🗑️ Deleting customer ${id}...`);
      return apiCall(`${API_BASE_URL}/api/customers/${id}`, {
        method: "DELETE",
      });
    },
  },

  // PRODUCTS
  products: {
    getAll: async () => {
      console.log("📦 Getting all products...");
      const data = await apiCall(`${API_BASE_URL}/api/products`);
      return data?.data || data || [];
    },

    getById: async (id: string) => {
      console.log(`📦 Getting product ${id}...`);
      const data = await apiCall(`${API_BASE_URL}/api/products/${id}`);
      return data?.data || data;
    },

    create: async (data: {
      name: string;
      price: number;
      stock: number;
      description?: string;
    }) => {
      console.log("➕ Creating product...");
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
      console.log(`✏️ Updating product ${id}...`);
      const result = await apiCall(`${API_BASE_URL}/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    delete: async (id: string) => {
      console.log(`🗑️ Deleting product ${id}...`);
      return apiCall(`${API_BASE_URL}/api/products/${id}`, {
        method: "DELETE",
      });
    },
  },

  // ORDERS - UPDATED TO REMOVE STATUS VALIDATION
  orders: {
    getAll: async (params?: {
      status?: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      page?: number;
      search?: string;
      paymentMethod?: string;
    }) => {
      console.log("📊 Getting all orders...");
      let url = `${API_BASE_URL}/api/orders`;
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.status) queryParams.append("status", params.status);
        if (params.customerId)
          queryParams.append("customerId", params.customerId);
        if (params.startDate) queryParams.append("startDate", params.startDate);
        if (params.endDate) queryParams.append("endDate", params.endDate);
        if (params.limit) queryParams.append("limit", params.limit.toString());
        if (params.page) queryParams.append("page", params.page.toString());
        if (params.search) queryParams.append("search", params.search);
        if (params.paymentMethod)
          queryParams.append("paymentMethod", params.paymentMethod);
      }

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const data = await apiCall(url);
      return data?.orders || data?.data || data || [];
    },

    getById: async (id: string) => {
      console.log(`📄 Getting order ${id}...`);
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
      console.log("➕ Creating order...");
      const cashierId = data.cashierId || "system";

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

    // UPDATED: Remove status validation, allow any status
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
      console.log(`✏️ Updating order ${id}...`);
      const result = await apiCall(`${API_BASE_URL}/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    delete: async (id: string) => {
      console.log(`🗑️ Deleting order ${id}...`);
      return apiCall(`${API_BASE_URL}/api/orders/${id}`, {
        method: "DELETE",
      });
    },

    // UPDATED: Allow any status transition
    updateStatus: async (id: string, status: string, reason?: string) => {
      console.log(`🔄 Updating order ${id} status to ${status}...`);
      const result = await apiCall(`${API_BASE_URL}/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      return result?.data || result;
    },

    getByStatus: async (
      status: string,
      params?: {
        startDate?: string;
        endDate?: string;
        limit?: number;
        page?: number;
      }
    ) => {
      console.log(`📊 Getting orders with status ${status}...`);
      let url = `${API_BASE_URL}/api/orders/status/${status}`;
      const queryParams = new URLSearchParams();

      if (params?.startDate) queryParams.append("startDate", params.startDate);
      if (params?.endDate) queryParams.append("endDate", params.endDate);
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.page) queryParams.append("page", params.page.toString());

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const data = await apiCall(url);
      return data?.orders || data?.data || data || [];
    },

    getTodaySummary: async () => {
      console.log("📅 Getting today's summary...");
      const data = await apiCall(`${API_BASE_URL}/api/orders/summary/today`);
      return data?.data || data;
    },

    getSummaryByRange: async (startDate: string, endDate: string) => {
      console.log(`📊 Getting summary from ${startDate} to ${endDate}...`);
      const data = await apiCall(
        `${API_BASE_URL}/api/orders/summary/range?startDate=${startDate}&endDate=${endDate}`
      );
      return data?.data || data;
    },

    getPaymentMethodStats: async (startDate?: string, endDate?: string) => {
      console.log("💳 Getting payment method stats...");
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
      console.log("📈 Getting channel analytics...");
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
      console.log(`📊 Getting daily sales report for ${date || 'today'}...`);
      const url = date
        ? `${API_BASE_URL}/api/reports/sales/daily?date=${date}`
        : `${API_BASE_URL}/api/reports/sales/daily`;

      const data = await apiCall(url);
      return data?.data || data;
    },

    getPaymentAnalytics: async (startDate?: string, endDate?: string) => {
      console.log("💰 Getting payment analytics...");
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
      console.log("📈 Getting channel performance...");
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
      console.log(`📦 Getting low stock report (threshold: ${threshold})...`);
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/inventory/low-stock?threshold=${threshold}`
      );
      return data?.data || data;
    },

    getCustomerHistory: async (customerId?: string, limit = 50) => {
      console.log(`👤 Getting customer history ${customerId ? 'for customer ' + customerId : 'for all customers'}...`);
      const url = customerId
        ? `${API_BASE_URL}/api/reports/customers/history?customerId=${customerId}&limit=${limit}`
        : `${API_BASE_URL}/api/reports/customers/history?limit=${limit}`;

      const data = await apiCall(url);
      return data?.data || data;
    },

    getSalesTrend: async (period = "weekly", weeks = 8) => {
      console.log(`📈 Getting sales trend (${period} for ${weeks} weeks)...`);
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/sales/trend?period=${period}&weeks=${weeks}`
      );
      return data?.data || data;
    },

    getInventoryValuation: async () => {
      console.log("📊 Getting inventory valuation...");
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/inventory/valuation`
      );
      return data?.data || data;
    },

    getDashboard: async () => {
      console.log("🏠 Getting dashboard data...");
      const data = await apiCall(`${API_BASE_URL}/api/reports/dashboard`);
      return data?.data || data;
    },

    exportReport: async (
      type: string,
      format = "json",
      params?: { startDate?: string; endDate?: string }
    ) => {
      console.log(`📤 Exporting ${type} report as ${format}...`);
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
      console.log(`📦 Getting stock movements ${type ? 'of type ' + type : ''}...`);
      const url =
        type && type !== "all"
          ? `${API_BASE_URL}/api/stock-movements?type=${type}`
          : `${API_BASE_URL}/api/stock-movements`;

      const data = await apiCall(url);
      return data?.data || data || [];
    },

    getById: async (id: string) => {
      console.log(`📦 Getting stock movement ${id}...`);
      const data = await apiCall(`${API_BASE_URL}/api/stock-movements/${id}`);
      return data?.data || data;
    },

    create: async (data: {
      productId: string;
      type: "sale" | "restock" | "adjustment" | "refund";
      quantity: number;
      reason?: string;
    }) => {
      console.log("➕ Creating stock movement...");
      const result = await apiCall(`${API_BASE_URL}/api/stock-movements`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result?.data || result;
    },

    getReport: async () => {
      console.log("📊 Getting stock movement report...");
      const data = await apiCall(
        `${API_BASE_URL}/api/stock-movements/report/summary`
      );
      return data?.data || data;
    },

    seedSampleData: async () => {
      console.log("🌱 Seeding sample stock data...");
      const result = await apiCall(
        `${API_BASE_URL}/api/stock-movements/seed-stock-data`,
        {
          method: "POST",
        }
      );
      return result?.data || result;
    },

    getProductHistory: async (productId: string) => {
      console.log(`📦 Getting product history for ${productId}...`);
      const data = await apiCall(
        `${API_BASE_URL}/api/stock-movements/product/${productId}`
      );
      return data?.data || data;
    },
  },

  // ANALYTICS
  analytics: {
    getPaymentMethods: async (startDate?: string, endDate?: string) => {
      console.log("💳 Getting payment methods analytics...");
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
      console.log("📈 Getting channels analytics...");
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
      console.log("💰 Getting payment analytics...");
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
      console.log("📈 Getting channel performance...");
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
      console.log("🏠 Getting analytics dashboard...");
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
          (p: any) => `${p.method}: ${p.percentage}%`
        ),
        channelSplit: dailySales?.channelInsights?.split?.map(
          (c: any) => `${c.channel}: ${c.percentage}%`
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

// NEW: Check authentication state
export const checkAuthState = () => {
  const token = localStorage.getItem("token");
  console.group("🔍 Authentication State");
  console.log("📱 LocalStorage token:", token ? "✅ Present" : "❌ Missing");
  console.log("🏷️ Token length:", token?.length || 0);
  
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log("👤 User ID:", payload.userId);
      console.log("🎯 Role:", payload.role);
      console.log("⏰ Expires:", new Date(payload.exp * 1000).toLocaleString());
      console.log("🔄 Valid:", Date.now() < payload.exp * 1000);
    } catch (e) {
      console.error("❌ Invalid token format");
    }
  }
  console.groupEnd();
  return !!token;
};

// NEW: Test dashboard access
export const testDashboardAccess = async () => {
  console.group("🧪 Testing Dashboard Access");
  
  // Check auth state
  const token = getAuthToken();
  console.log("1. Token exists:", !!token);
  
  // Check if token is valid
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log("2. Token payload:", payload);
      console.log("3. Token valid until:", new Date(payload.exp * 1000));
    } catch (e) {
      console.error("4. Invalid token");
    }
  }
  
  // Try to access dashboard
  try {
    console.log("5. Attempting to fetch dashboard...");
    const result = await api.reports.getDashboard();
    console.log("6. Dashboard fetch:", result?.success ? "✅ Success" : "❌ Failed");
    console.log("7. Response data:", result);
  } catch (error: any) {
    console.error("8. Dashboard error:", error.message);
  }
  
  console.groupEnd();
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

// Helper to check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() < payload.exp * 1000;
  } catch {
    return false;
  }
};

// Helper to get user role
export const getUserRole = (): string | null => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

// NEW: Monitor localStorage changes
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
      console.log(`🔄 Token changed in localStorage: ${e.newValue ? "Set" : "Removed"}`);
    }
  });
  
  // Also monitor beforeunload to check token state
  window.addEventListener('beforeunload', () => {
    console.log("🔍 Checking token before page unload...");
    checkAuthState();
  });
}