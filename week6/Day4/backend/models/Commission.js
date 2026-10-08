const mongoose = require("mongoose");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");

const commissionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
      required: true,
      unique: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    grossAmount: { type: Number, required: true, min: 0 },
    // Snapshot of the rate used -- changing COMMISSION_RATE later must not
    // rewrite what past sales were charged.
    commissionRate: { type: Number, required: true, min: 0, max: 1 },
    commissionAmount: { type: Number, required: true, min: 0 },
    vendorAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(COMMISSION_STATUS),
      default: COMMISSION_STATUS.PENDING,
    },
  },
  { timestamps: true },
);

commissionSchema.index({ vendor: 1, createdAt: -1 });
commissionSchema.index({ order: 1 });

module.exports = mongoose.model("Commission", commissionSchema);
