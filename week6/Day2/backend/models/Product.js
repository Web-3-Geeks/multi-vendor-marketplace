const mongoose = require("mongoose");
const PRODUCT_STATUS = require("../constants/productStatus");

const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value > 0,
        message: "Price must be greater than zero",
      },
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number",
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (list) => list.length <= 5,
        message: "A product can have at most 5 images",
      },
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.DRAFT,
    },
  },
  { timestamps: true },
);

productSchema.pre("validate", function () {
  if (this.status === PRODUCT_STATUS.ACTIVE && this.stock === 0) {
    this.status = PRODUCT_STATUS.OUT_OF_STOCK;
  } else if (this.status === PRODUCT_STATUS.OUT_OF_STOCK && this.stock > 0) {
    this.status = PRODUCT_STATUS.ACTIVE;
  }
});
productSchema.index({ vendor: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });

module.exports = mongoose.model("Product", productSchema);
