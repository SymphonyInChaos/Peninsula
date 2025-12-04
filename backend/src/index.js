// src/index.js or app.js
import express from "express";
import productRoutes from "./routes/products.js";
import customerRoutes from "./routes/customers.js";
import orderRoutes from "../src/routes/orders.js";
import commandRoutes from "../src/routes/command.js";
import reportRoutes from "../src/routes/report.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import prisma from "./utils/db.js";
import cors from "cors";

const app = express();
// ---- GLOBAL RATE LIMITER ----
// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 500,
//   standardHeaders: true,
//   legacyHeaders: false
// });

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:8080", // Your frontend URL
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Routes
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/commands", commandRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/auth", authRoutes);

// Health check with basic stats
app.get("/health", async (req, res) => {
  try {
    const [productCount, customerCount, orderCount, todayRevenue] =
      await Promise.all([
        prisma.product.count(),
        prisma.customer.count(),
        prisma.order.count(),
        prisma.order.aggregate({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
          _sum: { total: true },
        }),
      ]);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "Inventory Management API",
      stats: {
        products: productCount,
        customers: customerCount,
        orders: orderCount,
        todayRevenue: todayRevenue._sum.total || 0,
      },
    });
  } catch (error) {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "Inventory Management API",
      error: "Unable to fetch stats",
    });
  }
});

// 404 handler - FIXED: Use proper path
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🛍️ API Base: http://localhost:${PORT}/api`);
});

export default app;
