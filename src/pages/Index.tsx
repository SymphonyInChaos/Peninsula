import { Navigate } from "react-router-dom";
import { useStore } from "@/store/useStore";

const Index = () => {
  const { isAuthenticated, viewMode } = useStore();

  // 🔐 User NOT logged in → Go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 🎨 If user prefers prompt view → Redirect to AI Prompt Page
  if (viewMode === "prompt") {
    return <Navigate to="/prompt" replace />;
  }

  // 🧭 Default → Go to dashboard
  return <Navigate to="/dashboard" replace />;
};

export default Index;
