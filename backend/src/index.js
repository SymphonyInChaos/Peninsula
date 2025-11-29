import express from "express";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/products.js";
import customerRoutes from "./routes/customers.js";
import orderRoutes from "./routes/orders.js";
import commandRoutes from "./routes/command.js";
import authRoutes from "./routes/authRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cors from "cors";
// 
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
// API Routes
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/commands", commandRoutes);
app.use("/api/auth", authRoutes);
// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Inventory Management API",
  });
});
// 404 fallback (Express 5 safe version)
app.all(/.*/, (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});
// 
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Global error handler
app.use(errorHandler);

export default app;
