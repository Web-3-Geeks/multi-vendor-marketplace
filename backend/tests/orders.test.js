const db = require("./helpers/db");
const f = require("./helpers/factory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Commission = require("../models/Commission");

beforeAll(db.connect);
afterAll(db.disconnect);

let vendorA;
let vendorB;
beforeAll(async () => {
  vendorA = await f.createVendor();
  vendorB = await f.createVendor();
});

const setItemStatus = (vendor, orderId, status) =>
  f.api().patch(`/api/vendor/orders/${orderId}/status`).set(f.bearer(vendor.token)).send({ status });
const vendorOrders = (vendor, query = "") => f.api().get(`/api/vendor/orders${query}`).set(f.bearer(vendor.token));

describe("a customer's own orders", () => {
  let customer;
  let orders;
  beforeAll(async () => {
    customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 500 });
    orders = [];
    for (let i = 0; i < 12; i += 1) orders.push(await f.placeOrder(customer, [[product, 1]]));
  });

  test("the list is paginated (10 per page), newest first", async () => {
    const res = await f.api().get("/api/orders").set(f.bearer(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(10);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 12, totalPages: 2 });
    expect(res.body.orders[0].id).toBe(orders[11].id);
  });

  test("paging through returns every order exactly once, each with its items and vendor", async () => {
    const seen = [];
    for (let page = 1; page <= 4; page += 1) {
      const res = await f.api().get(`/api/orders?limit=4&page=${page}`).set(f.bearer(customer.token));
      seen.push(...res.body.orders);
    }
    expect(seen.map((o) => o.id).sort()).toEqual(orders.map((o) => o.id).sort());
    expect(seen.every((o) => o.items.length === 1 && o.items[0].vendor.storeName === vendorA.storeName)).toBe(true);
  });

  test("a page past the end is empty, bad paging parameters are 400", async () => {
    expect((await f.api().get("/api/orders?page=99").set(f.bearer(customer.token))).body.orders).toEqual([]);
    for (const bad of ["page=0", "limit=0", "limit=51", "limit=abc", "page=-1"]) {
      expect((await f.api().get(`/api/orders?${bad}`).set(f.bearer(customer.token))).status).toBe(400);
    }
  });

  test("one order can be read by its owner; anybody else gets 404", async () => {
    const stranger = await f.createUser();
    const mine = await f.api().get(`/api/orders/${orders[0].id}`).set(f.bearer(customer.token));
    expect(mine.status).toBe(200);
    expect(mine.body.order.items[0].productName).toEqual(expect.any(String));
    const theirs = await f.api().get(`/api/orders/${orders[0].id}`).set(f.bearer(stranger.token));
    expect(theirs.status).toBe(404);
    expect(theirs.body.message).toBe("Order not found");
    expect((await f.api().get("/api/orders").set(f.bearer(stranger.token))).body.orders).toEqual([]);
  });

  test("an admin has no special access through the customer endpoints", async () => {
    const admin = await f.createAdmin();
    expect((await f.api().get(`/api/orders/${orders[0].id}`).set(f.bearer(admin.token))).status).toBe(404);
  });

  test("bad and unknown ids", async () => {
    expect((await f.api().get("/api/orders/not-an-id").set(f.bearer(customer.token))).status).toBe(400);
    expect((await f.api().get("/api/orders/507f1f77bcf86cd799439011").set(f.bearer(customer.token))).status).toBe(404);
  });
});

describe("what a vendor sees of a multi-vendor order", () => {
  let customer;
  let order;
  let prodA;
  let prodB;
  beforeAll(async () => {
    customer = await f.createUser();
    prodA = await f.createProduct(vendorA, { name: "Vendor A item", price: 10, stock: 20 });
    prodB = await f.createProduct(vendorB, { name: "Vendor B item", price: 30, stock: 20 });
    order = await f.placeOrder(customer, [[prodA, 2], [prodB, 1]]);
  });

  test("each vendor sees only their own lines and their own subtotal", async () => {
    const a = await f.api().get(`/api/vendor/orders/${order.id}`).set(f.bearer(vendorA.token));
    expect(a.status).toBe(200);
    expect(a.body.order.items.map((i) => i.productName)).toEqual(["Vendor A item"]);
    expect(a.body.order.vendorSubtotal).toBe(20);
    expect(JSON.stringify(a.body)).not.toMatch(/Vendor B item/);

    const b = await f.api().get(`/api/vendor/orders/${order.id}`).set(f.bearer(vendorB.token));
    expect(b.body.order.items.map((i) => i.productName)).toEqual(["Vendor B item"]);
    expect(b.body.order.vendorSubtotal).toBe(30);
  });

  test("a vendor with no items in an order gets 404, as does a bad id", async () => {
    const outsider = await f.createVendor();
    expect((await f.api().get(`/api/vendor/orders/${order.id}`).set(f.bearer(outsider.token))).status).toBe(404);
    expect((await setItemStatus(outsider, order.id, "CANCELLED")).status).toBe(404);
    expect((await f.api().get("/api/vendor/orders/nope").set(f.bearer(vendorA.token))).status).toBe(400);
  });

  test("the list holds only orders containing the vendor's products", async () => {
    const other = await f.createUser();
    const lonely = await f.createProduct(vendorB, { stock: 5 });
    const lonelyOrder = await f.placeOrder(other, [[lonely, 1]]);
    const a = await vendorOrders(vendorA, "?limit=50");
    expect(a.body.orders.some((o) => o.orderId === order.id)).toBe(true);
    expect(a.body.orders.some((o) => o.orderId === lonelyOrder.id)).toBe(false);
  });

  test("the customer's address is hidden from vendors until the order is paid", async () => {
    const unpaid = await f.api().get(`/api/vendor/orders/${order.id}`).set(f.bearer(vendorA.token));
    expect(unpaid.body.order.shippingAddress).toBeNull();
    expect(JSON.stringify(unpaid.body)).not.toContain(f.ADDRESS.line1);

    await f.payOrder(customer, order.id);
    const paid = await f.api().get(`/api/vendor/orders/${order.id}`).set(f.bearer(vendorA.token));
    expect(paid.body.order.shippingAddress).toMatchObject({ fullName: f.ADDRESS.fullName, line1: f.ADDRESS.line1 });
    const outsider = await f.createVendor();
    expect(JSON.stringify(await vendorOrders(outsider))).not.toContain(f.ADDRESS.line1);
  });

  test("the vendor list is paginated by whole orders, newest first", async () => {
    const owner = await f.createVendor();
    const buyer = await f.createUser();
    const product = await f.createProduct(owner, { stock: 200 });
    const other = await f.createProduct(owner, { stock: 200 });
    const placed = [];
    for (let i = 0; i < 6; i += 1) placed.push(await f.placeOrder(buyer, [[product, 1], [other, 1]]));

    const first = await vendorOrders(owner, "?limit=4&page=1");
    expect(first.body.pagination).toMatchObject({ total: 6, totalPages: 2, limit: 4 });
    expect(first.body.orders).toHaveLength(4);
    expect(first.body.orders.every((o) => o.items.length === 2)).toBe(true);
    expect(first.body.orders[0].orderId).toBe(placed[5].id);
    const second = await vendorOrders(owner, "?limit=4&page=2");
    expect(second.body.orders).toHaveLength(2);
    const ids = [...first.body.orders, ...second.body.orders].map((o) => o.orderId);
    expect(new Set(ids).size).toBe(6);
    expect((await vendorOrders(owner, "?limit=100")).status).toBe(400);
  });
});

describe("fulfilment", () => {
  let customer;
  beforeEach(async () => {
    customer = await f.createUser();
  });

  test("a vendor can't advance an order nobody has paid for", async () => {
    const product = await f.createProduct(vendorA);
    const order = await f.placeOrder(customer, [[product, 1]]);
    const res = await setItemStatus(vendorA, order.id, "CONFIRMED");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not been paid/);
  });

  test("after payment the items move one step at a time and the customer sees the progress", async () => {
    const product = await f.createProduct(vendorA);
    const order = await f.placeOrder(customer, [[product, 1]]);
    await f.payOrder(customer, order.id);

    expect((await setItemStatus(vendorA, order.id, "SHIPPED")).status).toBe(400);
    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      const res = await setItemStatus(vendorA, order.id, status);
      expect(res.status).toBe(200);
      expect(res.body.order.items[0].status).toBe(status);
    }
    const seen = await f.api().get(`/api/orders/${order.id}`).set(f.bearer(customer.token));
    expect(seen.body.order.status).toBe("DELIVERED");
  });

  test("nothing can follow DELIVERED or CANCELLED, nothing goes backwards", async () => {
    const product = await f.createProduct(vendorA);
    const order = await f.placeOrder(customer, [[product, 1]]);
    await f.payOrder(customer, order.id);
    await setItemStatus(vendorA, order.id, "PROCESSING");
    expect((await setItemStatus(vendorA, order.id, "CONFIRMED")).status).toBe(400);
    await setItemStatus(vendorA, order.id, "SHIPPED");
    await setItemStatus(vendorA, order.id, "DELIVERED");
    for (const status of ["PROCESSING", "CANCELLED", "DELIVERED"]) expect((await setItemStatus(vendorA, order.id, status)).status).toBe(400);
  });

  test("only statuses a vendor may set are accepted", async () => {
    const product = await f.createProduct(vendorA);
    const order = await f.placeOrder(customer, [[product, 1]]);
    for (const status of ["PENDING", "BOGUS", "", { $ne: 1 }]) {
      expect((await setItemStatus(vendorA, order.id, status)).status).toBe(400);
    }
  });

  test("a customer can't use the vendor endpoint", async () => {
    const product = await f.createProduct(vendorA);
    const order = await f.placeOrder(customer, [[product, 1]]);
    expect((await f.api().patch(`/api/vendor/orders/${order.id}/status`).set(f.bearer(customer.token)).send({ status: "CANCELLED" })).status).toBe(403);
  });

  test("in a multi-vendor order the overall status is the least advanced vendor's", async () => {
    const a = await f.createProduct(vendorA);
    const b = await f.createProduct(vendorB);
    const order = await f.placeOrder(customer, [[a, 1], [b, 1]]);
    await f.payOrder(customer, order.id);
    await setItemStatus(vendorA, order.id, "PROCESSING");
    await setItemStatus(vendorA, order.id, "SHIPPED");
    expect((await Order.findById(order.id)).status).toBe("CONFIRMED");
    await setItemStatus(vendorB, order.id, "PROCESSING");
    expect((await Order.findById(order.id)).status).toBe("PROCESSING");
  });

  test("cancelling returns the stock, voids the commission, and a fully cancelled paid order stays PAID until refunded", async () => {
    const product = await f.createProduct(vendorA, { stock: 10 });
    const order = await f.placeOrder(customer, [[product, 3]]);
    await f.payOrder(customer, order.id);
    expect((await Product.findById(product._id)).stock).toBe(7);

    const res = await setItemStatus(vendorA, order.id, "CANCELLED");
    expect(res.status).toBe(200);
    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await Commission.findOne({ order: order.id })).status).toBe("CANCELLED");
    const stored = await Order.findById(order.id);
    expect(stored).toMatchObject({ status: "CANCELLED", paymentStatus: "PAID" });
  });

  test("cancelling an unpaid order releases its stock and marks it unpayable", async () => {
    const product = await f.createProduct(vendorA, { stock: 5 });
    const order = await f.placeOrder(customer, [[product, 2]]);
    await setItemStatus(vendorA, order.id, "CANCELLED");
    expect((await Product.findById(product._id)).stock).toBe(5);
    expect((await Order.findById(order.id)).paymentStatus).toBe("CANCELLED");
    expect((await f.createPayment(customer, order.id)).status).toBe(400);
  });

  test("cancelling twice doesn't return the stock twice", async () => {
    const product = await f.createProduct(vendorA, { stock: 5 });
    const order = await f.placeOrder(customer, [[product, 2]]);
    await Promise.all([setItemStatus(vendorA, order.id, "CANCELLED"), setItemStatus(vendorA, order.id, "CANCELLED")]);
    await setItemStatus(vendorA, order.id, "CANCELLED");
    expect((await Product.findById(product._id)).stock).toBe(5);
  });
});

describe("unpaid orders are cleaned up lazily", () => {
  const backdate = f.backdateOrder;

  test("an order unpaid for 24 hours is cancelled (stock returned) the next time someone checks out", async () => {
    const customer = await f.createUser();
    const other = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 10 });
    const stale = await f.placeOrder(customer, [[product, 4]]);
    await backdate(stale.id, 25);
    expect((await Product.findById(product._id)).stock).toBe(6);

    await f.placeOrder(other, [[product, 1]]);
    expect(await Order.findById(stale.id).lean()).toMatchObject({ status: "CANCELLED", paymentStatus: "CANCELLED" });
    expect((await Product.findById(product._id)).stock).toBe(9);
  });

  test("recent unpaid orders, paid orders and orders from before payments existed are left alone", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendorA, { stock: 50 });
    const recent = await f.placeOrder(customer, [[product, 1]]);
    const paid = await f.placeOrder(customer, [[product, 1]]);
    await f.payOrder(customer, paid.id);
    const legacy = await f.placeOrder(customer, [[product, 1]]);
    await Order.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(legacy.id) }, { $unset: { paymentStatus: "" } });
    for (const o of [recent, paid, legacy]) await backdate(o.id, o === recent ? 2 : 48);

    await f.placeOrder(await f.createUser(), [[product, 1]]);
    expect((await Order.findById(recent.id)).status).toBe("PENDING");
    expect((await Order.findById(paid.id)).status).toBe("CONFIRMED");
    expect((await Order.findById(legacy.id)).status).toBe("PENDING");
  });

  test("orders before the address field existed still open for the customer, admin and payment", async () => {
    const customer = await f.createUser();
    const admin = await f.createAdmin();
    const product = await f.createProduct(vendorA);
    const order = await f.placeOrder(customer, [[product, 1]]);
    await Order.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(order.id) }, { $unset: { shippingAddress: "" } });

    const mine = await f.api().get(`/api/orders/${order.id}`).set(f.bearer(customer.token));
    expect(mine.body.order.shippingAddress).toBeNull();
    expect((await f.api().get(`/api/admin/orders/${order.id}`).set(f.bearer(admin.token))).body.order.shippingAddress).toBeNull();
    expect((await f.payOrder(customer, order.id)).status).toBe("PAID");
    expect((await vendorOrders(vendorA, "?limit=50")).body.orders.find((o) => o.orderId === order.id).shippingAddress).toBeNull();
    expect(await OrderItem.countDocuments({ order: order.id })).toBe(1);
  });
});
