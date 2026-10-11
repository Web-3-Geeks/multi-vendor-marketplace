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
const RETRY_MS = 5000;

// Error text that is safe to show on /api/health: no connection string, no host names.
const describeError = (err) =>
  `${err.name}: ${String(err.message)}`
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "<uri>")
    .replace(/[a-z0-9.-]+\.mongodb\.net(:\d+)?/gi, "<host>")
    .slice(0, 300);

// A failed connection is retried instead of killing the process: on serverless a dead
// process just restarts into the same failure, and /api/health can explain what is wrong.
const connect = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL, {
      // In production indexes are created by `npm run db:setup`, not on every cold start.
      autoIndex: process.env.NODE_ENV !== "production",
      serverSelectionTimeoutMS: 10000,
    });
    app.locals.dbError = null;
    console.log("MongoDB connected");
  } catch (err) {
    app.locals.dbError = describeError(err);
    console.error("MongoDB connection failed:", app.locals.dbError);
    setTimeout(connect, RETRY_MS);
  }
};

connect();
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
