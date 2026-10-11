const mongoose = require("mongoose");
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

// Loaded after dotenv: the app reads FRONTEND_URL and friends when it is built.
const { getCommissionRate } = require("./services/commissionService");
const app = require("./app");

try {
  getCommissionRate();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

mongoose
  // In production indexes are created by `npm run db:setup`, not on every cold start.
  .connect(process.env.DATABASE_URL, { autoIndex: process.env.NODE_ENV !== "production" })
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
