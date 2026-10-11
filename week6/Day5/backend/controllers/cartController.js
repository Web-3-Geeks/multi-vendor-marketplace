const Product = require("../models/Product");
const CartItem = require("../models/CartItem");
const { getOrCreateCart, getCartDetails, itemIssue } = require("../services/cartService");

const loadProductWithVendor = (id) => Product.findById(id).populate("vendor", "storeName status");

const getCart = async (req, res) => {
  const cart = await getCartDetails(req.user._id);
  res.json({ cart });
};

const addCartItem = async (req, res) => {
  const { productId, quantity } = req.body;

  const product = await loadProductWithVendor(productId);
  const issue = itemIssue(product);
  if (issue) {
    return res.status(400).json({ message: issue });
  }

  const cart = await getOrCreateCart(req.user._id);
  const existing = await CartItem.findOne({ cart: cart._id, product: product._id });
  const newQuantity = (existing?.quantity || 0) + quantity;

  if (newQuantity > product.stock) {
    return res.status(400).json({
      message: `Only ${product.stock} left in stock`,
    });
  }

  if (existing) {
    existing.quantity = newQuantity;
    await existing.save();
  } else {
    await CartItem.create({ cart: cart._id, product: product._id, quantity });
  }

  res.status(201).json({ cart: await getCartDetails(req.user._id) });
};

const updateCartItem = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = await CartItem.findOne({ _id: req.params.id, cart: cart._id });
  if (!item) {
    return res.status(404).json({ message: "Cart item not found" });
  }

  const product = await loadProductWithVendor(item.product);
  const issue = itemIssue(product);
  if (issue) {
    return res.status(400).json({ message: issue });
  }

  if (req.body.quantity > product.stock) {
    return res.status(400).json({ message: `Only ${product.stock} left in stock` });
  }

  item.quantity = req.body.quantity;
  await item.save();

  res.json({ cart: await getCartDetails(req.user._id) });
};

const removeCartItem = async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = await CartItem.findOneAndDelete({ _id: req.params.id, cart: cart._id });
  if (!item) {
    return res.status(404).json({ message: "Cart item not found" });
  }

  res.json({ cart: await getCartDetails(req.user._id) });
};

module.exports = { getCart, addCartItem, updateCartItem, removeCartItem };
