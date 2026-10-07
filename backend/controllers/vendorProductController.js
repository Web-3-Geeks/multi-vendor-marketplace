const Product = require("../models/Product");
const Category = require("../models/Category");
const PRODUCT_STATUS = require("../constants/productStatus");
const uniqueSlug = require("../utils/uniqueSlug");

const EDITABLE_FIELDS = ["name", "description", "price", "stock", "category", "images", "status"];

const publishErrors = (product) => {
  const errors = [];
  if (!product.description || !product.description.trim()) {
    errors.push({ field: "description", message: "Description is required to publish" });
  }
  return errors;
};

const createProduct = async (req, res) => {
  const data = {};
  for (const key of EDITABLE_FIELDS) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }

  if (!(await Category.exists({ _id: data.category }))) {
    return res.status(400).json({ message: "Category does not exist" });
  }

  const product = new Product({
    ...data,
    vendor: req.vendor._id,
    slug: uniqueSlug(data.name),
  });

  if (product.status === PRODUCT_STATUS.ACTIVE) {
    const errors = publishErrors(product);
    if (errors.length) {
      return res.status(400).json({ message: "Product cannot be published", errors });
    }
  }

  await product.save();
  res.status(201).json({ product });
};

const listMyProducts = async (req, res) => {
  const filter = { vendor: req.vendor._id };
  if (req.query.status) filter.status = req.query.status;

  const products = await Product.find(filter)
    .populate("category", "name slug")
    .sort({ createdAt: -1 });

  res.json({ products });
};

const getMyProduct = async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    vendor: req.vendor._id,
  }).populate("category", "name slug");

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  res.json({ product });
};

const updateMyProduct = async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (req.body.category !== undefined && !(await Category.exists({ _id: req.body.category }))) {
    return res.status(400).json({ message: "Category does not exist" });
  }

  for (const key of EDITABLE_FIELDS) {
    if (req.body[key] !== undefined) product[key] = req.body[key];
  }

  if (req.body.name !== undefined) {
    product.slug = uniqueSlug(product.name);
  }

  const goingLive =
    product.status === PRODUCT_STATUS.ACTIVE || product.status === PRODUCT_STATUS.OUT_OF_STOCK;
  if (goingLive) {
    const errors = publishErrors(product);
    if (errors.length) {
      return res.status(400).json({ message: "Product cannot be published", errors });
    }
  }

  await product.save();
  res.json({ product });
};

const archiveMyProduct = async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  product.status = PRODUCT_STATUS.ARCHIVED;
  await product.save();

  res.json({ message: "Product archived", product });
};

module.exports = { createProduct, listMyProducts, getMyProduct, updateMyProduct, archiveMyProduct };
