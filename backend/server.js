const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const adminVendorRoutes = require("./routes/adminVendorRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const vendorProductRoutes = require("./routes/vendorProductRoutes");
const publicProductRoutes = require("./routes/publicProductRoutes");
const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const orderRoutes = require("./routes/orderRoutes");
const vendorOrderRoutes = require("./routes/vendorOrderRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const vendorEarningsRoutes = require("./routes/vendorEarningsRoutes");
const adminPaymentRoutes = require("./routes/adminPaymentRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminStatsRoutes = require("./routes/adminStatsRoutes");
const { getCommissionRate } = require("./services/commissionService");
const dotenv = require("dotenv");

dotenv.config();

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "FRONTEND_URL",
  "PAYMENT_PROVIDER",
  "PAYMENT_PUBLIC_KEY",
  "PAYMENT_SECRET_KEY",
  "PAYMENT_WEBHOOK_SECRET",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

try {
  getCommissionRate();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use("/api/payments/webhook", express.raw({ type: "*/*" }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

app.use("/api", dashboardRoutes);

app.use("/api/vendors", vendorRoutes);

app.use("/api/admin/vendors", adminVendorRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/vendor/products", vendorProductRoutes);

app.use("/api/products", publicProductRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/checkout", checkoutRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/vendor/orders", vendorOrderRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/vendor/earnings", vendorEarningsRoutes);

app.use("/api/admin/payments", adminPaymentRoutes);

app.use("/api/admin/orders", adminOrderRoutes);

app.use("/api/admin/stats", adminStatsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
