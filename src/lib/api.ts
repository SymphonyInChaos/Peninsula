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
    }) => {
      const result = await apiCall(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result.data || result;
    },

    update: async (
      id: string,
      data: {
        customerId?: string | null;
        items?: Array<{ productId: string; qty: number }>;
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
  },

  reports: {
    getDailySales: async (date?: string) => {
      const url = date
        ? `${API_BASE_URL}/api/reports/sales/daily?date=${date}`
        : `${API_BASE_URL}/api/reports/sales/daily`;

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

    exportReport: async (type: string, format = "json") => {
      const data = await apiCall(
        `${API_BASE_URL}/api/reports/export/${type}?format=${format}`
      );
      return data.data || data;
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
};
