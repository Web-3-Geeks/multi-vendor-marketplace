const db = require("./helpers/db");
const f = require("./helpers/factory");
const Commission = require("../models/Commission");

beforeAll(db.connect);
afterAll(db.disconnect);

const earnings = (vendor, query = "") => f.api().get(`/api/vendor/earnings${query}`).set(f.bearer(vendor.token));
const setItemStatus = (vendor, orderId, status) =>
  f.api().patch(`/api/vendor/orders/${orderId}/status`).set(f.bearer(vendor.token)).send({ status });

describe("commission calculation", () => {
  test("is gross x rate per order item, vendor amount is the remainder", async () => {
    const vendor = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(vendor, { price: 100, stock: 10 });
    const order = await f.placeOrder(customer, [[product, 2]]);
    await f.payOrder(customer, order.id);

    const [row] = await Commission.find({ order: order.id });
    expect(row).toMatchObject({ grossAmount: 200, commissionRate: 0.1, commissionAmount: 20, vendorAmount: 180, status: "PENDING" });
    expect(String(row.vendor)).toBe(vendor.vendorId);
  });

  test("amounts are rounded to the cent and always add up to the gross", async () => {
    const vendor = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(vendor, { price: 33.33, stock: 10 });
    const order = await f.placeOrder(customer, [[product, 3]]);
    await f.payOrder(customer, order.id);
    const [row] = await Commission.find({ order: order.id });
    expect(row.grossAmount).toBe(99.99);
    expect(row.commissionAmount).toBe(10);
    expect(row.vendorAmount).toBe(89.99);
    expect(Math.round((row.commissionAmount + row.vendorAmount) * 100) / 100).toBe(row.grossAmount);
  });

  test("a multi-vendor order creates one row per item, each credited to its own vendor", async () => {
    const a = await f.createVendor();
    const b = await f.createVendor();
    const customer = await f.createUser();
    const pa = await f.createProduct(a, { price: 10 });
    const pb = await f.createProduct(b, { price: 40 });
    const order = await f.placeOrder(customer, [[pa, 1], [pb, 1]]);
    await f.payOrder(customer, order.id);

    const rows = await Commission.find({ order: order.id });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => String(r.vendor) === a.vendorId)).toMatchObject({ grossAmount: 10, commissionAmount: 1, vendorAmount: 9 });
    expect(rows.find((r) => String(r.vendor) === b.vendorId)).toMatchObject({ grossAmount: 40, commissionAmount: 4, vendorAmount: 36 });
  });

  test("nothing is earned until the payment is verified", async () => {
    const vendor = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(vendor);
    const order = await f.placeOrder(customer, [[product, 1]]);
    const { body } = await f.createPayment(customer, order.id);
    await f.mockPay(customer, body.payment.transactionId, "failure");
    expect(await Commission.countDocuments({ order: order.id })).toBe(0);
    expect((await earnings(vendor)).body.summary.netEarnings).toBe(0);
  });

  test("the rate used is saved on each row, so changing it later doesn't rewrite history", async () => {
    const vendor = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(vendor, { price: 100, stock: 10 });
    const first = await f.placeOrder(customer, [[product, 1]]);
    await f.payOrder(customer, first.id);

    process.env.COMMISSION_RATE = "0.25";
    try {
      const second = await f.placeOrder(customer, [[product, 1]]);
      await f.payOrder(customer, second.id);
    } finally {
      process.env.COMMISSION_RATE = "0.10";
    }
    const rows = await Commission.find({ vendor: vendor.vendorId }).sort({ createdAt: 1 });
    expect(rows.map((r) => [r.commissionRate, r.commissionAmount])).toEqual([[0.1, 10], [0.25, 25]]);
  });
});

describe("the commission life cycle", () => {
  let vendor;
  let customer;
  let order;
  beforeEach(async () => {
    vendor = await f.createVendor();
    customer = await f.createUser();
    const product = await f.createProduct(vendor, { price: 50, stock: 20 });
    order = await f.placeOrder(customer, [[product, 2]]);
    await f.payOrder(customer, order.id);
  });

  test("starts PENDING and becomes PAID once the item is delivered", async () => {
    const before = await earnings(vendor);
    expect(before.body.summary).toMatchObject({ pendingEarnings: 90, paidEarnings: 0, netEarnings: 90 });
    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) await setItemStatus(vendor, order.id, status);
    const after = await earnings(vendor);
    expect(after.body.summary).toMatchObject({ pendingEarnings: 0, paidEarnings: 90, netEarnings: 90 });
    expect(after.body.transactions[0].status).toBe("PAID");
  });

  test("is cancelled with the item and then counts for nothing", async () => {
    await setItemStatus(vendor, order.id, "CANCELLED");
    const res = await earnings(vendor);
    expect(res.body.summary).toMatchObject({ totalSales: 0, totalCommission: 0, netEarnings: 0, salesCount: 0 });
    expect(res.body.transactions[0].status).toBe("CANCELLED");
  });
});

describe("the vendor's earnings", () => {
  let vendor;
  let rival;
  beforeAll(async () => {
    vendor = await f.createVendor();
    rival = await f.createVendor();
    const customer = await f.createUser();
    const mine = await f.createProduct(vendor, { name: "Mine", price: 100, stock: 50 });
    const theirs = await f.createProduct(rival, { name: "Theirs", price: 70, stock: 50 });
    for (let i = 0; i < 3; i += 1) {
      const order = await f.placeOrder(customer, [[mine, 1], [theirs, 1]]);
      await f.payOrder(customer, order.id);
    }
  });

  test("the summary totals only the vendor's own sales", async () => {
    const res = await earnings(vendor);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ salesCount: 3, totalSales: 300, totalCommission: 30, netEarnings: 270, paidEarnings: 0, pendingEarnings: 270 });
    expect((await earnings(rival)).body.summary).toMatchObject({ totalSales: 210, netEarnings: 189 });
  });

  test("the history lists their own items with order, product and amounts - never another vendor's", async () => {
    const res = await earnings(vendor);
    expect(res.body.transactions).toHaveLength(3);
    for (const t of res.body.transactions) {
      expect(t).toMatchObject({ productName: "Mine", quantity: 1, grossAmount: 100, commissionRate: 0.1, commissionAmount: 10, vendorAmount: 90, status: "PENDING" });
      expect(t.orderId).toEqual(expect.any(String));
    }
    expect(JSON.stringify(res.body)).not.toContain("Theirs");
  });

  test("can be paginated, filtered by status and by date", async () => {
    const page = await earnings(vendor, "?limit=2&page=2");
    expect(page.body.transactions).toHaveLength(1);
    expect(page.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect((await earnings(vendor, "?status=PAID")).body.transactions).toHaveLength(0);
    expect((await earnings(vendor, "?status=PENDING")).body.transactions).toHaveLength(3);

    const today = new Date().toISOString().slice(0, 10);
    expect((await earnings(vendor, `?from=${today}&to=${today}`)).body.transactions).toHaveLength(3);
    const future = await earnings(vendor, "?from=2999-01-01");
    expect(future.body.transactions).toHaveLength(0);
    expect(future.body.summary.netEarnings).toBe(270);
  });

  test.each(["status=NOPE", "page=0", "limit=51", "from=notadate", "to=2026-13-45x"])("rejects ?%s with 400", async (query) => {
    expect((await earnings(vendor, `?${query}`)).status).toBe(400);
  });

  test("a vendor with no sales gets zeros, not an error", async () => {
    const fresh = await f.createVendor();
    const res = await earnings(fresh);
    expect(res.body.summary).toEqual({ salesCount: 0, totalSales: 0, totalCommission: 0, netEarnings: 0, paidEarnings: 0, pendingEarnings: 0 });
    expect(res.body.transactions).toEqual([]);
  });

  test("customers and admins can't read earnings", async () => {
    const customer = await f.createUser();
    const admin = await f.createAdmin();
    expect((await earnings(customer)).status).toBe(403);
    expect((await earnings(admin)).status).toBe(403);
    expect((await f.api().get("/api/vendor/earnings")).status).toBe(401);
  });
});
