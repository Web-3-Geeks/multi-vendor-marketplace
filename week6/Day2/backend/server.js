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
const dashboardRoutes = require("./routes/dashboardRoutes");
const dotenv = require("dotenv");

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");

app.use(cors({ origin: process.env.FRONTEND_URL }));
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
