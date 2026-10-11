const db = require("./helpers/db");
const f = require("./helpers/factory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const CartItem = require("../models/CartItem");

beforeAll(db.connect);
afterAll(db.disconnect);

let vendorA;
let vendorB;
beforeAll(async () => {
  vendorA = await f.createVendor();
  vendorB = await f.createVendor();
});

const getCart = (user) => f.api().get("/api/cart").set(f.bearer(user.token));
const stockOf = async (product) => (await Product.findById(product._id)).stock;

describe("the cart", () => {
  test("adding a product creates a cart row with DB prices", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { price: 12.5, stock: 10 });
    const res = await f.addToCart(customer, product._id, 2);
    expect(res.status).toBe(201);
    expect(res.body.cart.items[0]).toMatchObject({ quantity: 2, unitPrice: 12.5, subtotal: 25, issue: null });
    expect(res.body.cart).toMatchObject({ subtotal: 25, itemCount: 2, hasIssues: false });
  });

  test("a client-sent price is ignored", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { price: 40 });
    const res = await f.api().post("/api/cart/items").set(f.bearer(customer.token)).send({ productId: String(product._id), quantity: 1, price: 0.01, unitPrice: 0.01 });
    expect(res.body.cart.subtotal).toBe(40);
  });

  test("adding the same product again merges into one row", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 10 });
    await f.addToCart(customer, product._id, 2);
    const res = await f.addToCart(customer, product._id, 3);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(5);
    expect(await CartItem.countDocuments({ product: product._id })).toBe(1);
  });

  test("it can never hold more than the stock", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 3 });
    await f.addToCart(customer, product._id, 2);
    const res = await f.addToCart(customer, product._id, 2);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Only 3 left in stock");
    const direct = await f.addToCart(customer, product._id, 99);
    expect(direct.status).toBe(400);
  });

  test("products that aren't for sale can't be added", async () => {
    const customer = await f.createUser();
    for (const status of ["DRAFT", "ARCHIVED", "OUT_OF_STOCK"]) {
      const product = await f.createProduct(vendorA, { status, stock: status === "OUT_OF_STOCK" ? 0 : 5 });
      expect((await f.addToCart(customer, product._id, 1)).status).toBe(400);
    }
    const suspended = await f.createVendor({ status: "SUSPENDED" });
    const orphan = await f.createProduct(suspended);
    expect((await f.addToCart(customer, orphan._id, 1)).status).toBe(400);
    expect((await f.addToCart(customer, "507f1f77bcf86cd799439011", 1)).status).toBe(400);
  });

  test.each([
    ["zero quantity", { quantity: 0 }],
    ["negative quantity", { quantity: -2 }],
    ["fractional quantity", { quantity: 1.5 }],
    ["huge quantity", { quantity: 100000 }],
    ["quantity as text", { quantity: "many" }],
    ["quantity as an object", { quantity: { $gt: 0 } }],
    ["missing product", { productId: undefined }],
    ["product id that isn't an id", { productId: "nope" }],
    ["product id as an object", { productId: { $ne: null } }],
  ])("rejects %s with 400", async (_label, patch) => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA);
    const res = await f.api().post("/api/cart/items").set(f.bearer(customer.token)).send({ productId: String(product._id), quantity: 1, ...patch });
    expect(res.status).toBe(400);
  });

  test("items are grouped per vendor with their own subtotals", async () => {
    const customer = await f.createUser();
    const a = await f.createProduct(vendorA, { price: 10 });
    const b = await f.createProduct(vendorB, { price: 25 });
    await f.addToCart(customer, a._id, 2);
    const res = await f.addToCart(customer, b._id, 1);
    expect(res.body.cart.vendorGroups).toHaveLength(2);
    const groupA = res.body.cart.vendorGroups.find((g) => g.vendor.id === vendorA.vendorId);
    expect(groupA).toMatchObject({ subtotal: 20 });
    expect(res.body.cart.subtotal).toBe(45);
    expect(res.body.cart.itemCount).toBe(3);
  });

  test("quantity can be updated within the stock; zero or too many is refused", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 4 });
    const added = await f.addToCart(customer, product._id, 1);
    const itemId = added.body.cart.items[0].id;
    const patch = (quantity) => f.api().patch(`/api/cart/items/${itemId}`).set(f.bearer(customer.token)).send({ quantity });
    expect((await patch(3)).body.cart.itemCount).toBe(3);
    expect((await patch(5)).status).toBe(400);
    expect((await patch(0)).status).toBe(400);
  });

  test("items can be removed", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA);
    const added = await f.addToCart(customer, product._id, 1);
    const res = await f.api().delete(`/api/cart/items/${added.body.cart.items[0].id}`).set(f.bearer(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(0);
  });

  test("another user's cart item is 404 for update and delete, and stays untouched", async () => {
    const owner = await f.createUser();
    const stranger = await f.createUser();
    const product = await f.createProduct(vendorA);
    const added = await f.addToCart(owner, product._id, 1);
    const itemId = added.body.cart.items[0].id;
    expect((await f.api().patch(`/api/cart/items/${itemId}`).set(f.bearer(stranger.token)).send({ quantity: 2 })).status).toBe(404);
    expect((await f.api().delete(`/api/cart/items/${itemId}`).set(f.bearer(stranger.token))).status).toBe(404);
    expect((await getCart(owner)).body.cart.items[0].quantity).toBe(1);
    expect((await getCart(stranger)).body.cart.items).toHaveLength(0);
  });

  test("a product that became unavailable is flagged, not silently removed", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 5 });
    await f.addToCart(customer, product._id, 3);
    await Product.updateOne({ _id: product._id }, { stock: 1 });
    const res = await getCart(customer);
    expect(res.body.cart.hasIssues).toBe(true);
    expect(res.body.cart.items[0].issue).toBe("Only 1 left in stock");
    await Product.updateOne({ _id: product._id }, { status: "ARCHIVED" });
    expect((await getCart(customer)).body.cart.items[0].issue).toMatch(/no longer available/);
  });
});

describe("checkout", () => {
  test("creates an order with server-calculated totals, snapshots and the address", async () => {
    const customer = await f.createUser();
    const a = await f.createProduct(vendorA, { name: "Alpha", price: 10, stock: 10 });
    const b = await f.createProduct(vendorB, { name: "Beta", price: 25.5, stock: 10 });
    const order = await f.placeOrder(customer, [[a, 2], [b, 1]]);

    expect(order).toMatchObject({ status: "PENDING", paymentStatus: "PENDING", subtotal: 45.5, totalAmount: 45.5, shippingAmount: 0, discountAmount: 0, taxAmount: 0 });
    expect(order.items).toHaveLength(2);
    expect(order.items.find((i) => i.productName === "Alpha")).toMatchObject({ unitPrice: 10, quantity: 2, subtotal: 20, status: "PENDING" });
    expect(order.shippingAddress).toMatchObject({ fullName: f.ADDRESS.fullName, city: "Lahore", line2: null, state: null });
  });

  test("decrements stock and empties the cart in the same step", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 10 });
    await f.placeOrder(customer, [[product, 4]]);
    expect(await stockOf(product)).toBe(6);
    expect((await getCart(customer)).body.cart.items).toHaveLength(0);
  });

  test("selling the last unit flips the product to OUT_OF_STOCK", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 2 });
    await f.placeOrder(customer, [[product, 2]]);
    expect((await Product.findById(product._id)).status).toBe("OUT_OF_STOCK");
  });

  test("uses the price at checkout time, not the price when the item went into the cart", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { price: 10 });
    await f.addToCart(customer, product._id, 1);
    await Product.updateOne({ _id: product._id }, { price: 15 });
    const res = await f.checkout(customer);
    expect(res.body.order.totalAmount).toBe(15);
  });

  test("client-sent totals, status, payment status and user are all ignored", async () => {
    const customer = await f.createUser();
    const other = await f.createUser();
    const product = await f.createProduct(vendorA, { price: 30 });
    await f.addToCart(customer, product._id, 1);
    const res = await f
      .api()
      .post("/api/checkout")
      .set(f.bearer(customer.token))
      .send({ shippingAddress: f.ADDRESS, totalAmount: 1, subtotal: 1, status: "CONFIRMED", paymentStatus: "PAID", user: other.id });
    expect(res.body.order).toMatchObject({ totalAmount: 30, status: "PENDING", paymentStatus: "PENDING" });
    expect(String((await Order.findById(res.body.order.id)).user)).toBe(customer.id);
  });

  test("an empty cart is a 400 and creates nothing", async () => {
    const customer = await f.createUser();
    const res = await f.checkout(customer);
    expect(res.status).toBe(400);
    expect(await Order.countDocuments({ user: customer.id })).toBe(0);
  });

  test("if any item can't be fulfilled the whole checkout fails and nothing changes", async () => {
    const customer = await f.createUser();
    const ok = await f.createProduct(vendorA, { stock: 10 });
    const scarce = await f.createProduct(vendorB, { stock: 5 });
    await f.addToCart(customer, ok._id, 2);
    await f.addToCart(customer, scarce._id, 4);
    await Product.updateOne({ _id: scarce._id }, { stock: 1 });

    const res = await f.checkout(customer);
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ message: "Only 1 left of " + scarce.name })]);
    expect(await Order.countDocuments({ user: customer.id })).toBe(0);
    expect(await stockOf(ok)).toBe(10);
    expect(await stockOf(scarce)).toBe(1);
    expect((await getCart(customer)).body.cart.items).toHaveLength(2);
  });

  test("two customers racing for the last unit: exactly one wins and stock never goes negative", async () => {
    const product = await f.createProduct(vendorA, { stock: 1 });
    const [one, two] = await Promise.all([f.createUser(), f.createUser()]);
    await f.addToCart(one, product._id, 1);
    await f.addToCart(two, product._id, 1);

    const results = await Promise.all([f.checkout(one), f.checkout(two)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await stockOf(product)).toBe(0);
    expect(await OrderItem.countDocuments({ product: product._id })).toBe(1);
  });

  test("repeating the same checkout request can't create a second order from one cart", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 10 });
    await f.addToCart(customer, product._id, 1);
    const results = await Promise.all([f.checkout(customer), f.checkout(customer), f.checkout(customer)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await stockOf(product)).toBe(9);
    expect(await Order.countDocuments({ user: customer.id })).toBe(1);
  });

  describe("the shipping address", () => {
    const product = () => f.createProduct(vendorA, { stock: 100 });
    const attempt = async (customer, product, shippingAddress) => {
      await f.addToCart(customer, product._id, 1);
      return f.api().post("/api/checkout").set(f.bearer(customer.token)).send({ shippingAddress });
    };

    test.each([
      ["missing entirely", undefined],
      ["a string", "12 Garden Road"],
      ["an array", ["x"]],
      ["null", null],
    ])("is required: %s -> 400", async (_label, value) => {
      const customer = await f.createUser();
      const res = await attempt(customer, await product(), value);
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === "shippingAddress")).toBe(true);
    });

    test.each(["fullName", "phone", "line1", "city", "postalCode", "country"])("%s is required", async (field) => {
      const customer = await f.createUser();
      const address = { ...f.ADDRESS };
      delete address[field];
      const res = await attempt(customer, await product(), address);
      expect(res.status).toBe(400);
      expect(res.body.errors.some((e) => e.field === `shippingAddress.${field}`)).toBe(true);
    });

    test.each([
      ["a phone with letters", { phone: "call me" }],
      ["a too-short phone", { phone: "12" }],
      ["a postal code with symbols", { postalCode: "!!##" }],
      ["whitespace-only city", { city: "   " }],
      ["an over-long address", { line1: "x".repeat(201) }],
      ["an over-long name", { fullName: "x".repeat(101) }],
      ["an object as the name", { fullName: { $ne: null } }],
      ["an array as the city", { city: ["a", "b"] }],
    ])("rejects %s", async (_label, patch) => {
      const customer = await f.createUser();
      const res = await attempt(customer, await product(), { ...f.ADDRESS, ...patch });
      expect(res.status).toBe(400);
    });

    test("a rejected address leaves the cart and stock alone", async () => {
      const customer = await f.createUser();
      const p = await product();
      await attempt(customer, p, { ...f.ADDRESS, phone: "bad" });
      expect(await stockOf(p)).toBe(100);
      expect((await getCart(customer)).body.cart.items).toHaveLength(1);
    });

    test("only the known fields are stored, values are trimmed, optionals come back null", async () => {
      const customer = await f.createUser();
      const p = await product();
      const res = await attempt(customer, p, { fullName: "  Bob  ", phone: " 0300-1234567 ", line1: " 1 Road ", city: " Karachi ", postalCode: " 75000 ", country: " Pakistan ", role: "ADMIN", isAdmin: true });
      expect(res.status).toBe(201);
      expect(res.body.order.shippingAddress).toEqual({ fullName: "Bob", phone: "0300-1234567", line1: "1 Road", line2: null, city: "Karachi", state: null, postalCode: "75000", country: "Pakistan" });
      const stored = (await Order.findById(res.body.order.id).lean()).shippingAddress;
      expect(Object.keys(stored).sort()).toEqual(["city", "country", "fullName", "line1", "phone", "postalCode"]);
    });
  });
});
