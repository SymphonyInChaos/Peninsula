import { Outlet, NavLink } from "react-router-dom";
import { Package, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/useStore";
import { Menu } from "lucide-react";
import { useState } from "react";

const DashboardLayout = () => {
  const { logout } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-64 border-r p-4 bg-card">
          <h1 className="text-xl font-bold mb-4">Peninsula</h1>

          <nav className="flex flex-col gap-2">
            <NavLink to="products" className="px-3 py-2 rounded hover:bg-accent flex gap-3">
              <Package size={18} /> Products
            </NavLink>

            <NavLink to="orders" className="px-3 py-2 rounded hover:bg-accent flex gap-3">
              <ShoppingCart size={18} /> Orders
            </NavLink>

            <NavLink to="customers" className="px-3 py-2 rounded hover:bg-accent flex gap-3">
              <Users size={18} /> Customers
            </NavLink>

            <NavLink to="reports" className="px-3 py-2 rounded hover:bg-accent flex gap-3">
              <TrendingUp size={18} /> Reports
            </NavLink>
          </nav>

          <div className="mt-auto pt-4">
            <Button onClick={logout} variant="ghost" className="w-full justify-start">
              Logout
            </Button>
          </div>
        </aside>
      )}

      {/* Content */}
      <div className="flex-1">
        <header className="h-14 border-b flex items-center px-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={20} />
          </Button>
        </header>

        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
