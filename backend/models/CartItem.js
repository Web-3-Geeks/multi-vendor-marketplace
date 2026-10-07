const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
      min: [1, "Quantity must be greater than zero"],
    },
  },
  { timestamps: true },
);

// One row per product per cart -- adding an already-present product increases
// quantity instead of creating a second row (enforced in the controller, backed
// up here at the database level).
cartItemSchema.index({ cart: 1, product: 1 }, { unique: true });

module.exports = mongoose.model("CartItem", cartItemSchema);
