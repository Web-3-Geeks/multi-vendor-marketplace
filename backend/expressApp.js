// The configured Express app, without starting a server or opening a database
// connection. server.js runs it for real; the tests import it directly.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const requestLogger = require("./middleware/requestLogger");
const sanitizeBody = require("./middleware/sanitize");
const { globalLimiter, webhookLimiter } = require("./middleware/rateLimit");
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
const adminProductRoutes = require("./routes/adminProductRoutes");
const adminAuditRoutes = require("./routes/adminAuditRoutes");

const app = express();
app.disable("x-powered-by");

// Vercel (and most hosts) put one proxy in front of the app; without this every
// visitor would share the proxy's IP and the rate limiters would count them together.
if (process.env.VERCEL || process.env.TRUST_PROXY) app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(requestLogger);
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use("/api", globalLimiter);
app.use("/api/payments/webhook", webhookLimiter, express.raw({ type: "*/*", limit: "100kb" }));
app.use(express.json({ limit: "100kb" }));
app.use(sanitizeBody);

app.get("/api/health", (req, res) => {
  const databaseUp = mongoose.connection.readyState === 1;
  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? "ok" : "degraded",
    database: databaseUp ? "connected" : "disconnected",
    // Why the last connection attempt failed (credentials and host names removed).
    ...(!databaseUp && app.locals.dbError ? { reason: app.locals.dbError } : {}),
    uptime: Math.round(process.uptime()),
  });
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

app.use("/api/admin/products", adminProductRoutes);

app.use("/api/admin/audit-logs", adminAuditRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
