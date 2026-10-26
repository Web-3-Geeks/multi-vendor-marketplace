// What must be true before a product can be live on the marketplace.
const publishErrors = (product) => {
  const errors = [];
  if (!product.description || !product.description.trim()) {
    errors.push({ field: "description", message: "Description is required to publish" });
  }
  return errors;
};

module.exports = { publishErrors };
