const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../constants/orderStatus");

const orderItemSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    // Snapshot at purchase time -- if the vendor renames or reprices the
    // product later, this order still shows what the customer actually bought.
    productName: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    // Per-vendor fulfillment status. The parent Order's status is derived from
    // these (see services/orderService.js) so a multi-vendor order can show
    // real progress even while one vendor ships before another.
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
  },
  { timestamps: true },
);

orderItemSchema.index({ order: 1 });
orderItemSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model("OrderItem", orderItemSchema);
