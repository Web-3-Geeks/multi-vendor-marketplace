const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingAmount: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model("Order", orderSchema);
