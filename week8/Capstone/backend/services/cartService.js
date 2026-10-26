const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const PRODUCT_STATUS = require("../constants/productStatus");
const VENDOR_STATUS = require("../constants/vendorStatus");

// findOne-then-create would race if the same brand-new user fired two add-to-cart
// requests at once (both see no cart, both try to create one, second hits the
// unique index and throws). findOneAndUpdate with upsert does the find-or-create
// atomically in one round trip to the database.
const getOrCreateCart = async (userId) => {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { returnDocument: "after", upsert: true },
  );
};

// What's wrong with this item right now, if anything -- used by GET /cart (to
// show a warning) and by checkout (to decide whether it can go through at all).
const itemIssue = (product) => {
  if (!product) return "This product no longer exists";
  if (product.status === PRODUCT_STATUS.ARCHIVED) return "This product is no longer available";
  if (product.status !== PRODUCT_STATUS.ACTIVE) return "This product is not currently for sale";
  if (!product.vendor || product.vendor.status !== VENDOR_STATUS.APPROVED) {
    return "This vendor is not currently active";
  }
  return null;
};

const toCartItemDTO = (item) => {
  const product = item.product;
  const issue = itemIssue(product);
  const unitPrice = product ? product.price : 0;
  const quantity = item.quantity;
  const availableStock = product ? product.stock : 0;

  return {
    id: item._id,
    quantity,
    unitPrice,
    subtotal: Math.round(unitPrice * quantity * 100) / 100,
    issue: issue || (product && quantity > availableStock ? `Only ${availableStock} left in stock` : null),
    product: product && {
      id: product._id,
      name: product.name,
      slug: product.slug,
      image: product.images?.[0] || null,
      stock: product.stock,
      status: product.status,
    },
    vendor: product?.vendor && {
      id: product.vendor._id,
      storeName: product.vendor.storeName,
    },
  };
};

// Loads the cart's items with product + vendor populated, builds the response
// shape (grouped by vendor, with subtotals), all in one place so GET /cart and
// the post-mutation responses from add/update/remove stay identical.
const getCartDetails = async (userId) => {
  const cart = await getOrCreateCart(userId);
  const items = await CartItem.find({ cart: cart._id })
    .populate({
      path: "product",
      populate: { path: "vendor", select: "storeName status" },
    })
    .sort({ createdAt: 1 });

  const dtoItems = items.map(toCartItemDTO);

  const vendorGroups = new Map();
  for (const item of dtoItems) {
    const key = item.vendor ? String(item.vendor.id) : "unknown";
    if (!vendorGroups.has(key)) {
      vendorGroups.set(key, { vendor: item.vendor, items: [], subtotal: 0 });
    }
    const group = vendorGroups.get(key);
    group.items.push(item);
    group.subtotal = Math.round((group.subtotal + item.subtotal) * 100) / 100;
  }

  const subtotal = Math.round(dtoItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
  const itemCount = dtoItems.reduce((sum, i) => sum + i.quantity, 0);

  return {
    id: cart._id,
    items: dtoItems,
    vendorGroups: Array.from(vendorGroups.values()),
    subtotal,
    itemCount,
    hasIssues: dtoItems.some((i) => i.issue),
  };
};

module.exports = { getOrCreateCart, getCartDetails, itemIssue };
