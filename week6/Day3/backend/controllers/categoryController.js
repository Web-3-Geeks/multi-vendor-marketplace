const Category = require("../models/Category");
const Product = require("../models/Product");
const slugify = require("../utils/slugify");

const createCategory = async (req, res) => {
  const { name, description } = req.body;
  const slug = slugify(name);

  const category = await Category.create({ name, slug, description });

  res.status(201).json({ category });
};

const listCategories = async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ categories });
};

const updateCategory = async (req, res) => {
  const { name, description } = req.body;

  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  if (name !== undefined) {
    category.name = name;
    category.slug = slugify(name);
  }
  if (description !== undefined) {
    category.description = description;
  }

  await category.save();

  res.json({ category });
};

const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const inUse = await Product.exists({ category: category._id });
  if (inUse) {
    return res.status(409).json({
      message: "This category is used by products and cannot be deleted",
    });
  }

  await category.deleteOne();
  res.json({ message: "Category deleted" });
};


module.exports = { createCategory, listCategories, updateCategory, deleteCategory };
