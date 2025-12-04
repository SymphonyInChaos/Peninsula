import { Navigate, Outlet } from "react-router-dom";
import { useStore } from "@/store/useStore";

interface ProtectedProps {
  children?: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedProps) => {
  const { isAuthenticated } = useStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If children exist → return them
  if (children) return <>{children}</>;

  // Otherwise protect nested routes
  return <Outlet />;
};

export default ProtectedRoute;
