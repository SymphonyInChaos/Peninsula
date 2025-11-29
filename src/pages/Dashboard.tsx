import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  Menu,
  LogOut,
  Sparkles,
} from "lucide-react";
import ProductsView from "@/components/dashboard/ProductsView";
import OrdersView from "@/components/dashboard/OrdersView";
import CustomersView from "@/components/dashboard/CustomersView";
import ReportView from "@/components/dashboard/ReportView";

type ActiveView = "products" | "orders" | "customers" | "reports";

const Dashboard = () => {
  const [activeView, setActiveView] = useState<ActiveView>("products");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const { toggleViewMode, logout } = useStore();

  const menuItems = [
    { id: "products" as ActiveView, label: "Products", icon: Package },
    { id: "orders" as ActiveView, label: "Orders", icon: ShoppingCart },
    { id: "customers" as ActiveView, label: "Customers", icon: Users },
    { id: "reports" as ActiveView, label: "Reports", icon: TrendingUp },
  ];

  const renderView = () => {
    switch (activeView) {
      case "products":
        return <ProductsView />;
      case "orders":
        return <OrdersView />;
      case "customers":
        return <CustomersView />;
      case "reports":
        return <ReportView />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="sticky top-0 md:relative z-40 w-64 h-full border-r border-border bg-card/95 backdrop-blur-sm flex flex-col"
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-lg sm:text-xl font-light font-sans tracking-tight">
                  Peninsula
                </h1>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === item.id
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-border space-y-2">
              <Button
                onClick={toggleViewMode}
                variant="outline"
                className="w-full rounded-xl justify-start"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Prompt Mode
              </Button>
              <Button
                onClick={logout}
                variant="ghost"
                className="w-full rounded-xl justify-start text-muted-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sticky top-0 inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-xl"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h2 className="text-lg sm:text-2xl font-bold capitalize">
                {activeView}
              </h2>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
