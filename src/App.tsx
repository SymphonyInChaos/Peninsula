import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";


import Index from "./pages/Index";


import ProductsView from "@/components/dashboard/ProductsView";
import OrdersView from "@/components/dashboard/OrdersView";
import CustomersView from "@/components/dashboard/CustomersView";
import ReportsView from "@/components/dashboard/ReportsView";

import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoutes";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./components/dashboard/Layout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Auth />} />

          {/* Protected dashboard */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<ProductsView />} />
              <Route path="products" element={<ProductsView />} />
              <Route path="orders" element={<OrdersView />} />
              <Route path="customers" element={<CustomersView />} />
              <Route path="reports" element={<ReportsView />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
