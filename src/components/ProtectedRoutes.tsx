import { Navigate, Outlet } from "react-router-dom";
import { useStore } from "@/store/useStore";

const ProtectedRoute = () => {
  const { isAuthenticated } = useStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
