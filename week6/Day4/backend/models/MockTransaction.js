const mongoose = require("mongoose");

const mockTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ["requires_payment", "succeeded", "failed", "refunded"],
      default: "requires_payment",
    },
    refundId: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MockTransaction", mockTransactionSchema);
