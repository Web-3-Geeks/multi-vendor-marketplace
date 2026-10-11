const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

// Counters live in memory. On a long-running server that is a real limit; on
// Vercel serverless each warm instance counts separately, so treat these as a
// brake on abuse rather than a hard quota. Set RATE_LIMIT_DISABLED=true to turn
// every limiter off (automated tests, load testing).
const disabled = () => process.env.RATE_LIMIT_DISABLED === "true";

const ipKey = (req) => ipKeyGenerator(req.ip);
const userKey = (req) => (req.user?._id ? `user:${req.user._id}` : ipKey(req));

const limiter = ({ windowMs, limit, message, key = ipKey, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: disabled,
    skipSuccessfulRequests,
    keyGenerator: key,
    handler: (req, res) => res.status(429).json({ message }),
  });

const MINUTE = 60 * 1000;

module.exports = {
  // Every /api request, per IP.
  globalLimiter: limiter({ windowMs: MINUTE, limit: 300, message: "Too many requests. Please slow down." }),

  // Wrong passwords only: successful logins don't count, so real users are never locked out
  // by their own good behaviour. Limited per account and, more loosely, per IP.
  loginAccountLimiter: limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    key: (req) => `${ipKey(req)}|${String(req.body?.email || "").toLowerCase()}`,
    message: "Too many failed login attempts. Try again in 15 minutes.",
  }),
  loginIpLimiter: limiter({
    windowMs: 15 * MINUTE,
    limit: 50,
    skipSuccessfulRequests: true,
    message: "Too many failed login attempts. Try again in 15 minutes.",
  }),
  registerLimiter: limiter({ windowMs: 60 * MINUTE, limit: 20, message: "Too many accounts created. Try again later." }),

  // These run after authenticate, so they are counted per user.
  checkoutLimiter: limiter({ windowMs: MINUTE, limit: 20, key: userKey, message: "Too many checkout attempts. Please wait a minute." }),
  paymentLimiter: limiter({ windowMs: MINUTE, limit: 30, key: userKey, message: "Too many payment requests. Please wait a minute." }),
  refundLimiter: limiter({ windowMs: MINUTE, limit: 10, key: userKey, message: "Too many refund requests. Please wait a minute." }),

  // Called by the payment provider, not by people: generous, but not unlimited.
  webhookLimiter: limiter({ windowMs: MINUTE, limit: 300, message: "Too many webhook calls." }),
};
