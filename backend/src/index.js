import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import ordersRoute from "./routes/orders.js";
import customersRoute from "./routes/customers.js";
import productsRoute from "./routes/products.js";
import authRoutes from "./routes/authRoutes.js";
import rateLimit from "express-rate-limit";
dotenv.config();

const app = express();
// ---- GLOBAL RATE LIMITER ----
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);
// -----------------------------
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/orders", ordersRoute);
app.use("/api/customers", customersRoute);
app.use("/api/products", productsRoute);
app.use("/api/auth/" , authRoutes);
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
