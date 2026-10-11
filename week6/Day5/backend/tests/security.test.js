const db = require("./helpers/db");
const f = require("./helpers/factory");
const User = require("../models/User");

beforeAll(db.connect);
afterAll(db.disconnect);

describe("response headers and CORS", () => {
  test("helmet's security headers are set and the server doesn't advertise Express", async () => {
    const res = await f.api().get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("cross-origin API calls are allowed from the frontend origin only", async () => {
    const allowed = await f.api().get("/api/health").set("Origin", process.env.FRONTEND_URL);
    expect(allowed.headers["access-control-allow-origin"]).toBe(process.env.FRONTEND_URL);
    const other = await f.api().get("/api/health").set("Origin", "https://evil.example.com");
    expect(other.headers["access-control-allow-origin"]).toBe(process.env.FRONTEND_URL);
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
    expect(other.headers["access-control-allow-origin"]).not.toBe("*");
  });
});

describe("health check", () => {
  test("reports the database and uptime", async () => {
    const res = await f.api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "connected" });
    expect(res.body.uptime).toEqual(expect.any(Number));
  });
});

describe("hostile input", () => {
  test("a body larger than 100kb is refused", async () => {
    const res = await f.api().post("/api/auth/login").set("Content-Type", "application/json").send(JSON.stringify({ email: "a@test.com", password: "x".repeat(150000) }));
    expect(res.status).toBe(413);
  });

  test("malformed JSON is a clean 400", async () => {
    const res = await f.api().post("/api/auth/login").set("Content-Type", "application/json").send("{not valid json");
    expect(res.status).toBe(400);
  });

  test("operator-style keys ($where, dotted paths) are stripped and can't reach a query", async () => {
    const customer = await f.createUser();
    const vendor = await f.createVendor();
    const product = await f.createProduct(vendor);
    const res = await f
      .api()
      .post("/api/cart/items")
      .set(f.bearer(customer.token))
      .send({ productId: String(product._id), quantity: 1, $where: "sleep(5000)", "a.b": 1, nested: { $gt: "" } });
    expect(res.status).toBe(201);
  });

  test("a NoSQL operator in place of a login value can't bypass authentication", async () => {
    const user = await f.createUser();
    for (const body of [{ email: user.email, password: { $ne: "" } }, { email: { $ne: "" }, password: user.password }, { email: { $regex: ".*" }, password: { $gt: "" } }]) {
      const res = await f.api().post("/api/auth/login").send(body);
      expect(res.status).toBe(400);
      expect(res.body.token).toBeUndefined();
    }
  });

  test("query-string operators and duplicate parameters don't break or bypass filters", async () => {
    const admin = await f.createAdmin();
    for (const query of ["status[$ne]=PAID", "status=PAID&status=PENDING", "search=a&search=b", "limit[$gt]=1", "page[]=1"]) {
      const res = await f.api().get(`/api/admin/payments?${query}`).set(f.bearer(admin.token));
      expect(res.status).toBeLessThan(500);
    }
  });

  test("a regex bomb in a search term can't hang the server", async () => {
    const admin = await f.createAdmin();
    const started = Date.now();
    const res = await f.api().get(`/api/admin/orders?search=${encodeURIComponent("(a+)+$")}`).set(f.bearer(admin.token));
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe("clients can't set what only the server may decide", () => {
  test("registration can't choose a role", async () => {
    const res = await f.api().post("/api/auth/register").send({ name: "Mallory", email: `m-${f.unique()}@test.com`, password: "Passw0rd123", role: "ADMIN", isAdmin: true });
    expect(res.body.user.role).toBe("CUSTOMER");
    expect((await User.findById(res.body.user.id)).role).toBe("CUSTOMER");
  });

  test("a vendor can't create a product for another vendor or pick its status beyond the allowed ones", async () => {
    const vendor = await f.createVendor();
    const victim = await f.createVendor();
    const category = await f.getCategory();
    const res = await f.api().post("/api/vendor/products").set(f.bearer(vendor.token)).send({
      name: "Planted", description: "x", price: 5, stock: 1, category: String(category._id), vendor: victim.vendorId, takenDownByAdmin: true,
    });
    expect(String(res.body.product.vendor)).toBe(vendor.vendorId);
    expect(res.body.product.takenDownByAdmin).toBe(false);
  });

  test("an order's prices, totals and payment status can't be changed through any customer endpoint", async () => {
    const customer = await f.createUser();
    const vendor = await f.createVendor();
    const product = await f.createProduct(vendor, { price: 100 });
    const order = await f.placeOrder(customer, [[product, 1]]);
    const attempts = [
      f.api().patch(`/api/orders/${order.id}`).set(f.bearer(customer.token)).send({ totalAmount: 1, paymentStatus: "PAID" }),
      f.api().put(`/api/orders/${order.id}`).set(f.bearer(customer.token)).send({ totalAmount: 1, paymentStatus: "PAID" }),
      f.api().patch(`/api/vendor/orders/${order.id}/status`).set(f.bearer(customer.token)).send({ status: "CONFIRMED" }),
      f.api().patch(`/api/admin/orders/${order.id}/status`).set(f.bearer(customer.token)).send({ status: "CANCELLED" }),
    ];
    for (const res of await Promise.all(attempts)) expect([403, 404]).toContain(res.status);
    const stored = (await f.api().get(`/api/orders/${order.id}`).set(f.bearer(customer.token))).body.order;
    expect(stored).toMatchObject({ totalAmount: 100, paymentStatus: "PENDING", status: "PENDING" });
  });

  test("a customer can't mark their own payment as paid by any route other than the provider", async () => {
    const customer = await f.createUser();
    const vendor = await f.createVendor();
    const product = await f.createProduct(vendor);
    const order = await f.placeOrder(customer, [[product, 1]]);
    const { body } = await f.createPayment(customer, order.id);
    const forged = f.paymentEvent({ payment: body.payment });
    expect((await f.postWebhook(forged, "0".repeat(64))).status).toBe(400);
    expect((await f.verifyPayment(customer, body.payment.transactionId)).body.payment.status).toBe("PENDING");
  });
});

describe("errors reveal nothing", () => {
  test("an unexpected failure is a generic 500 with no stack, path or database details", async () => {
    const Product = require("../models/Product");
    const spy = jest.spyOn(Product, "find").mockImplementation(() => {
      throw new Error("connection to 10.0.0.5:27017 refused (password=hunter2)");
    });
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await f.api().get("/api/products");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Internal server error" });
      expect(res.text).not.toMatch(/10\.0\.0\.5|hunter2|at \w+ \(|node_modules/);
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });

  test("login errors, validation errors and 404s never echo the submitted password or token", async () => {
    const secret = "S3cret-Value-Do-Not-Echo";
    const results = await Promise.all([
      f.api().post("/api/auth/login").send({ email: "nobody@test.com", password: secret }),
      f.api().post("/api/auth/register").send({ name: "x", email: "bad", password: secret }),
      f.api().get("/api/auth/me").set(f.bearer(secret)),
    ]);
    for (const res of results) expect(res.text).not.toContain(secret);
  });

  test("a duplicate-key error is reported as a 409 without index internals", async () => {
    const email = `dup-${f.unique()}@test.com`;
    await f.api().post("/api/auth/register").send({ name: "A", email, password: "Passw0rd123" });
    const res = await f.api().post("/api/auth/register").send({ name: "B", email, password: "Passw0rd123" });
    expect(res.status).toBe(409);
    expect(res.text).not.toMatch(/E11000|index|collection/i);
  });
});

describe("rate limiting", () => {
  beforeAll(() => {
    process.env.RATE_LIMIT_DISABLED = "false";
  });
  afterAll(() => {
    process.env.RATE_LIMIT_DISABLED = "true";
  });

  test("repeated wrong passwords for one account are throttled, even for the right password afterwards", async () => {
    const user = await f.createUser();
    const statuses = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await f.api().post("/api/auth/login").send({ email: user.email, password: "wrong-password-1" })).status);
    expect(statuses.every((s) => s === 401)).toBe(true);

    const blocked = await f.api().post("/api/auth/login").send({ email: user.email, password: "wrong-password-1" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too many failed login attempts/);
    expect(blocked.headers.ratelimit || blocked.headers["ratelimit-policy"] || blocked.headers["retry-after"]).toBeDefined();
    expect((await f.api().post("/api/auth/login").send({ email: user.email, password: user.password })).status).toBe(429);
    expect((await f.api().post("/api/auth/login").send({ email: user.email.toUpperCase(), password: user.password })).status).toBe(429);
  });

  test("another account isn't affected, and successful logins never count against you", async () => {
    const other = await f.createUser();
    for (let i = 0; i < 15; i += 1) {
      expect((await f.api().post("/api/auth/login").send({ email: other.email, password: other.password })).status).toBe(200);
    }
  });

  test("registration is limited per IP", async () => {
    const statuses = [];
    for (let i = 0; i < 25; i += 1) {
      statuses.push((await f.api().post("/api/auth/register").send({ name: "Spam", email: `spam-${f.unique()}@test.com`, password: "Passw0rd123" })).status);
    }
    expect(statuses.filter((s) => s === 201).length).toBeLessThanOrEqual(20);
    expect(statuses).toContain(429);
  });

  test("checkout and payment calls are limited per user, and one user's limit doesn't affect another", async () => {
    const heavy = await f.createUser();
    const light = await f.createUser();
    const checkout = [];
    for (let i = 0; i < 21; i += 1) checkout.push((await f.checkout(heavy)).status);
    expect(checkout.slice(0, 20).every((s) => s === 400)).toBe(true);
    expect(checkout[20]).toBe(429);
    expect((await f.checkout(light)).status).toBe(400);

    const verify = [];
    for (let i = 0; i < 31; i += 1) verify.push((await f.verifyPayment(heavy, "mock_txn_nope")).status);
    expect(verify[29]).toBe(404);
    expect(verify[30]).toBe(429);
    expect((await f.verifyPayment(light, "mock_txn_nope")).status).toBe(404);
  });

  test("refunds are limited per admin", async () => {
    const admin = await f.createAdmin();
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await f.api().post("/api/admin/payments/507f1f77bcf86cd799439011/refund").set(f.bearer(admin.token)).send({})).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect((await f.api().get("/api/admin/stats").set(f.bearer(admin.token))).status).toBe(200);
  });

  test("every API route has an overall per-IP ceiling, the webhook included", async () => {
    const statuses = [];
    for (let i = 0; i < 310; i += 1) statuses.push((await f.api().get("/api/categories")).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses[0]).toBe(200);
    expect((await f.postWebhook({ id: "x", type: "y", data: {} })).status).toBe(429);
  });
});
