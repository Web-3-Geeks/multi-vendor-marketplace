const mongoose = require("mongoose");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD" },
    provider: { type: String, required: true },
    transactionId: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentMethod: { type: String },
    paidAt: { type: Date },
    expiresAt: { type: Date },
    refundId: { type: String },
    refundedAt: { type: Date },
    refundReason: { type: String },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    processedEventIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

paymentSchema.index({ order: 1, createdAt: -1 });
paymentSchema.index(
  { order: 1 },
  {
    unique: true,
    name: "one_open_payment_per_order",
    partialFilterExpression: {
      status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING] },
    },
  },
);
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
