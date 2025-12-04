import { Navigate } from "react-router-dom";
import { useStore } from "@/store/useStore";

const Index = () => {
  const { isAuthenticated } = useStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Navigate to="/dashboard" replace />;
};

export default Index;
