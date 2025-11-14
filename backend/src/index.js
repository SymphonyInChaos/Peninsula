import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import ordersRoute from "./routes/orders.js";
import customersRoute from "./routes/customers.js";
import productsRoute from "./routes/products.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/orders", ordersRoute);
app.use("/api/customers", customersRoute);
app.use("/api/products", productsRoute);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
