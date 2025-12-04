import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  Menu,
  Sparkles,
  LogOut,
  Bell,
  Boxes,
  MoveLeft,
  MoveRight,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import { useState, useEffect } from "react";
import NotificationDropdown from "./NotificationDropdown";

const SIDEBAR_FULL = 240;
const SIDEBAR_COLLAPSED = 72;

const DashboardLayout = () => {
  const { logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [isExpanded, setExpanded] = useState(true);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const menuItems = [
    { label: "Dashboard", icon: Boxes, to: "home" },
    { label: "Products", icon: Package, to: "products" },
    { label: "Orders", icon: ShoppingCart, to: "orders" },
    { label: "Customers", icon: Users, to: "customers" },
    { label: "Inventory", icon: Menu, to: "inventory" },
    { label: "Reports", icon: TrendingUp, to: "reports" },
  ];

  const titles = {
    "/dashboard/home": "Home",
    "/dashboard/products": "Products",
    "/dashboard/orders": "Orders",
    "/dashboard/customers": "Customers",
    "/dashboard/reports": "Reports",
    "/dashboard/inventory": "Inventory",
  };

  const pageTitle = titles[location.pathname] || "Dashboard";

  const handleNotificationToggle = () => {
    if (!isExpanded && !isMobile) setExpanded(true);
    setNotifyOpen((prev) => !prev);
  };

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setMobileOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getSidebarWidth = () => {
    if (isMobile) return 0;
    return isExpanded ? SIDEBAR_FULL : SIDEBAR_COLLAPSED;
  };

  return (
    <div className="flex min-h-screen bg-white text-foreground font-light overflow-hidden">
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      {!isMobile && (
        <div
          className="hidden md:block fixed left-0 top-0 h-screen z-30"
          style={{
            width: getSidebarWidth(),
            transition: "width 0.2s linear",
          }}
        >
          <aside className="h-full border-r border-border bg-card/80 backdrop-blur-xl flex flex-col">
            <div className="flex gap-2 p-6 items-center">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <Boxes className="w-4 h-4 text-primary-foreground" />
              </div>
              {isExpanded && (
                <h1 className="text-xl font-light italic tracking-tight">Peninsula</h1>
              )}
            </div>

            <nav className="flex-1 flex flex-col px-3 py-4 gap-2">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                    ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`
                  }
                >
                  <item.icon size={20} />
                  {isExpanded && item.label}
                </NavLink>
              ))}

              <Button
                onClick={() => navigate("/prompt")}
                className="mt-4 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-4"
              >
                <Sparkles size={18} />
                {isExpanded && "AI Prompt"}
              </Button>

              <div className="p-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full justify-center text-muted-foreground"
                  onClick={logout}
                >
                  <LogOut size={18} />
                  {isExpanded && "Logout"}
                </Button>
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* MOBILE SIDEBAR */}
      <AnimatePresence>
        {mobileOpen && isMobile && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 h-full w-60 bg-card/90 backdrop-blur-xl border-r border-border z-50 md:hidden flex flex-col"
          >
            <div className="flex gap-2 p-6 items-center">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <Boxes className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-light italic tracking-tight">Peninsula</h1>
            </div>

            <nav className="flex-1 p-4 flex flex-col gap-3">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                    ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}

              <Button
                onClick={() => {
                  navigate("/prompt");
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-3 mt-2"
              >
                <Sparkles size={18} />
                AI Prompt
              </Button>

              <div className="p-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                  onClick={logout}
                >
                  <LogOut size={18} className="mr-2" /> Logout
                </Button>
              </div>
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div
        className="flex-1 flex flex-col w-full transition-all duration-200"
        style={{
          marginLeft: getSidebarWidth(),
        }}
      >
        {/* HEADER */}
        <header
          className="fixed h-14 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-between px-4 z-20"
          style={{
            left: getSidebarWidth(),
            width: isMobile ? "100%" : `calc(100% - ${getSidebarWidth()}px)`,
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isMobile) setMobileOpen(true);
              else setExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <MoveLeft size={20} /> : <ArrowRight size={20} />}
          </Button>

          <h2 className="text-xl font-light tracking-tight">{pageTitle}</h2>

          <div className="relative">
            <Button variant="ghost" size="icon" onClick={handleNotificationToggle}>
              <Bell size={20} />
            </Button>
            <NotificationDropdown open={notifyOpen} />
          </div>
        </header>

        {/* CONTENT */}
        <main
          className="flex-1 p-4 sm:p-6 overflow-auto mt-14"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
