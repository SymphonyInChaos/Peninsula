// store/useStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, authDebug } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

type ViewMode = "traditional" | "prompt";

interface SystemState {
  isSetup: boolean;
  isLoading: boolean;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  system: SystemState;

  // Actions
  checkSystemSetup: () => Promise<void>;
  setup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: string
  ) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  clearError: () => void;
  toggleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;

  // User Management
  createUser: (userData: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) => Promise<void>;

  // Data fetching
  fetchDashboard: () => Promise<any>;
  fetchSalesReport: (date?: string) => Promise<any>;
  fetchLowStockReport: (threshold?: number) => Promise<any>;
}

export const useStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: localStorage.getItem("token"),
      isAuthenticated: !!localStorage.getItem("token"),
      isLoading: false,
      error: null,
      viewMode: "traditional",
      system: {
        isSetup: false,
        isLoading: false,
      },

      // Check if system is setup
      checkSystemSetup: async () => {
        try {
          set((state) => ({
            system: { ...state.system, isLoading: true },
          }));

          const response = await api.auth.checkSetup();

          if (response.success) {
            set((state) => ({
              system: {
                ...state.system,
                isSetup: response.data.hasUsers,
                isLoading: false,
              },
            }));
          }
        } catch (error: any) {
          console.error("❌ Setup check error:", error);
          set((state) => ({
            system: { ...state.system, isLoading: false },
          }));
        }
      },

      // Setup system with first admin user
      // In your useStore.ts - Update the setup method:
      setup: async (email: string, password: string, name: string) => {
        try {
          set({ isLoading: true, error: null });

          console.log("🚀 Starting setup with:", { email, name });

          // Call the setup endpoint, not register
          const response = await api.auth.setup({ email, password, name });

          if (response.success) {
            const { user, token } = response.data;

            // Store token in localStorage
            localStorage.setItem("token", token);

            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              system: { isSetup: true, isLoading: false },
            });

            console.log("✅ System setup successful:", user.email);
          } else {
            throw new Error(response.message || "Setup failed");
          }
        } catch (error: any) {
          console.error("❌ Setup error:", error);

          set({
            isLoading: false,
            error: error.message || "Setup failed",
            system: { isSetup: false, isLoading: false },
          });

          throw error;
        }
      },

      // Login action
      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await api.auth.login(email, password);

          if (response.success) {
            const { user, token } = response.data;

            // Store token in localStorage
            localStorage.setItem("token", token);

            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            console.log("✅ Login successful:", user.email);
          } else {
            throw new Error(response.message || "Login failed");
          }
        } catch (error: any) {
          console.error("❌ Login error:", error);

          // Clear any invalid token
          localStorage.removeItem("token");

          set({
            isLoading: false,
            error: error.message || "Login failed",
            token: null,
            isAuthenticated: false,
            user: null,
          });

          throw error;
        }
      },

      // Register action (for creating additional users - requires admin)
      register: async (
        email: string,
        password: string,
        name: string,
        role: string
      ) => {
        try {
          set({ isLoading: true, error: null });

          const response = await api.auth.register({
            email,
            password,
            name,
            role,
          });

          if (response.success) {
            const { user, token, isFirstUser } = response.data;

            // Store token in localStorage (user is automatically logged in after registration)
            localStorage.setItem("token", token);

            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
              system: {
                isSetup: true,
                isLoading: false,
              },
            });

            console.log("✅ Registration successful:", user.email);
            if (isFirstUser) {
              console.log("🎉 First admin account created!");
            }
          } else {
            throw new Error(response.message || "Registration failed");
          }
        } catch (error: any) {
          console.error("❌ Registration error:", error);

          set({
            isLoading: false,
            error: error.message || "Registration failed",
          });

          throw error;
        }
      },

      // Create user (admin only)
      createUser: async (userData: {
        email: string;
        password: string;
        name: string;
        role: string;
      }) => {
        try {
          set({ isLoading: true, error: null });

          const response = await api.users.create(userData);

          if (response.success) {
            set({
              isLoading: false,
              error: null,
            });

            console.log("✅ User created successfully:", userData.email);
            return response.data;
          } else {
            throw new Error(response.message || "User creation failed");
          }
        } catch (error: any) {
          console.error("❌ Create user error:", error);

          // Check if it's an auth error
          if (
            error.message?.includes("token") ||
            error.message?.includes("auth") ||
            error.message?.includes("401")
          ) {
            // Token might be invalid, clear it
            get().logout();
          }

          set({
            isLoading: false,
            error: error.message || "Failed to create user",
          });

          throw error;
        }
      },

      // Logout action
      logout: () => {
        localStorage.removeItem("token");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        console.log("👋 Logout successful");
      },

      // Check authentication status
      checkAuth: async (): Promise<boolean> => {
        const token = get().token;

        if (!token) {
          get().logout();
          return false;
        }

        try {
          set({ isLoading: true });

          // Debug token first
          const debugInfo = authDebug.checkToken();
          if (debugInfo?.isExpired) {
            throw new Error("Token expired");
          }

          const response = await api.auth.getMe();

          if (response.success) {
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            throw new Error("Invalid user data");
          }
        } catch (error: any) {
          console.error("❌ Auth check failed:", error);
          get().logout();
          return false;
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // View mode actions
      toggleViewMode: () => {
        const currentMode = get().viewMode;
        const newMode =
          currentMode === "traditional" ? "prompt" : "traditional";
        set({ viewMode: newMode });
        console.log("🎨 View mode changed to:", newMode);
      },

      setViewMode: (mode: ViewMode) => {
        set({ viewMode: mode });
      },

      // Data fetching methods
      fetchDashboard: async () => {
        try {
          set({ isLoading: true, error: null });
          const data = await api.reports.getDashboard();
          set({ isLoading: false });
          return data;
        } catch (error: any) {
          console.error("❌ Dashboard fetch error:", error);
          set({
            isLoading: false,
            error: error.message || "Failed to fetch dashboard",
          });
          throw error;
        }
      },

      fetchSalesReport: async (date?: string) => {
        try {
          set({ isLoading: true, error: null });
          const data = await api.reports.getDailySales(date);
          set({ isLoading: false });
          return data;
        } catch (error: any) {
          console.error("❌ Sales report fetch error:", error);
          set({
            isLoading: false,
            error: error.message || "Failed to fetch sales report",
          });
          throw error;
        }
      },

      fetchLowStockReport: async (threshold = 10) => {
        try {
          set({ isLoading: true, error: null });
          const data = await api.reports.getLowStock(threshold);
          set({ isLoading: false });
          return data;
        } catch (error: any) {
          console.error("❌ Low stock report fetch error:", error);
          set({
            isLoading: false,
            error: error.message || "Failed to fetch low stock report",
          });
          throw error;
        }
      },
    }),
    {
      name: "peninsula-auth-store",
      partialize: (state) => ({
        token: state.token,
        viewMode: state.viewMode,
        system: state.system,
      }),
    }
  )
);

// Export hooks for easier usage
export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    system,
    checkSystemSetup,
    setup,
    login,
    register,
    logout,
    checkAuth,
    clearError,
    createUser,
  } = useStore();

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    system,
    checkSystemSetup,
    setup,
    login,
    register,
    logout,
    checkAuth,
    clearError,
    createUser,
  };
};

export const useUI = () => {
  const { viewMode, toggleViewMode, setViewMode } = useStore();

  return {
    viewMode,
    toggleViewMode,
    setViewMode,
  };
};

export const useReports = () => {
  const { fetchDashboard, fetchSalesReport, fetchLowStockReport, isLoading } =
    useStore();

  return {
    fetchDashboard,
    fetchSalesReport,
    fetchLowStockReport,
    isLoading,
  };
};
