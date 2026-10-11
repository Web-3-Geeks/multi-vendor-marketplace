const db = require("./helpers/db");
const f = require("./helpers/factory");
const User = require("../models/User");

beforeAll(db.connect);
afterAll(db.disconnect);

const apply = (user, body = {}) =>
  f.api().post("/api/vendors").set(f.bearer(user.token)).send({ storeName: `Store ${f.unique()}`, storeDescription: "We sell things", ...body });

const setStatus = (admin, vendorId, status) =>
  f.api().patch(`/api/admin/vendors/${vendorId}/status`).set(f.bearer(admin.token)).send({ status });

describe("vendor application", () => {
  test("a customer applies and starts as PENDING", async () => {
    const customer = await f.createUser();
    const res = await apply(customer);
    expect(res.status).toBe(201);
    expect(res.body.vendor.status).toBe("PENDING");
  });

  test("a second application from the same user is a 409", async () => {
    const customer = await f.createUser();
    await apply(customer);
    expect((await apply(customer)).status).toBe(409);
  });

  test("vendors and admins can't apply", async () => {
    const vendor = await f.createVendor();
    const admin = await f.createAdmin();
    expect((await apply(vendor)).status).toBe(403);
    expect((await apply(admin)).status).toBe(403);
  });

  test.each([
    ["missing store name", { storeName: undefined }],
    ["blank store name", { storeName: "   " }],
    ["missing description", { storeDescription: undefined }],
    ["store name too long", { storeName: "x".repeat(101) }],
    ["description too long", { storeDescription: "x".repeat(1001) }],
    ["invalid logo URL", { logo: "not a url" }],
    ["store name as an object", { storeName: { $ne: "" } }],
  ])("rejects %s with 400", async (_label, patch) => {
    const customer = await f.createUser();
    const res = await apply(customer, patch);
    expect(res.status).toBe(400);
  });

  test("the applicant can see their own application, others see null", async () => {
    const customer = await f.createUser();
    const other = await f.createUser();
    await apply(customer, { storeName: "My Shop" });
    expect((await f.api().get("/api/vendors/me").set(f.bearer(customer.token))).body.vendor.storeName).toBe("My Shop");
    expect((await f.api().get("/api/vendors/me").set(f.bearer(other.token))).body.vendor).toBeNull();
  });

  test("a customer whose application is still pending cannot manage products", async () => {
    const customer = await f.createUser();
    await apply(customer);
    const res = await f.api().get("/api/vendor/products").set(f.bearer(customer.token));
    expect(res.status).toBe(403);
  });
});

describe("admin vendor management", () => {
  let admin;
  beforeAll(async () => {
    admin = await f.createAdmin();
  });

  test("approving makes the applicant a VENDOR who can use vendor features", async () => {
    const customer = await f.createUser();
    const { body } = await apply(customer);
    const res = await setStatus(admin, body.vendor.id, "APPROVED");
    expect(res.status).toBe(200);
    expect(res.body.vendor.status).toBe("APPROVED");
    expect((await User.findById(customer.id)).role).toBe("VENDOR");
    expect((await f.api().get("/api/vendor/products").set(f.bearer(customer.token))).status).toBe(200);
  });

  test("rejecting leaves (or returns) the user as a CUSTOMER", async () => {
    const customer = await f.createUser();
    const { body } = await apply(customer);
    const res = await setStatus(admin, body.vendor.id, "REJECTED");
    expect(res.body.vendor.status).toBe("REJECTED");
    expect((await User.findById(customer.id)).role).toBe("CUSTOMER");
  });

  test("suspending keeps the VENDOR role but blocks vendor features", async () => {
    const vendor = await f.createVendor();
    const res = await setStatus(admin, vendor.vendorId, "SUSPENDED");
    expect(res.status).toBe(200);
    expect((await User.findById(vendor.id)).role).toBe("VENDOR");
    expect((await f.api().get("/api/vendor/products").set(f.bearer(vendor.token))).status).toBe(403);
  });

  test("a suspended vendor can be reactivated", async () => {
    const vendor = await f.createVendor();
    await setStatus(admin, vendor.vendorId, "SUSPENDED");
    await setStatus(admin, vendor.vendorId, "APPROVED");
    expect((await f.api().get("/api/vendor/products").set(f.bearer(vendor.token))).status).toBe(200);
  });

  test("an invalid status, an unknown vendor and a bad id are rejected", async () => {
    const vendor = await f.createVendor();
    expect((await setStatus(admin, vendor.vendorId, "PENDING")).status).toBe(400);
    expect((await setStatus(admin, vendor.vendorId, { $ne: 1 })).status).toBe(400);
    expect((await setStatus(admin, "507f1f77bcf86cd799439011", "APPROVED")).status).toBe(404);
    expect((await setStatus(admin, "not-an-id", "APPROVED")).status).toBe(400);
  });

  test("only admins can change a vendor's status", async () => {
    const vendor = await f.createVendor();
    const customer = await f.createUser();
    expect((await setStatus(customer, vendor.vendorId, "SUSPENDED")).status).toBe(403);
    expect((await setStatus(vendor, vendor.vendorId, "SUSPENDED")).status).toBe(403);
  });

  test("the list can be filtered, searched and paginated", async () => {
    const unique = f.unique();
    for (let i = 0; i < 3; i += 1) await f.createVendor({ storeName: `Filter ${unique} ${i}` });
    await f.createVendor({ storeName: `Filter ${unique} pending`, status: "PENDING" });

    const search = await f.api().get(`/api/admin/vendors?search=Filter ${unique}&limit=2&page=1`).set(f.bearer(admin.token));
    expect(search.status).toBe(200);
    expect(search.body.vendors).toHaveLength(2);
    expect(search.body.pagination).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(search.body.vendors[0].user.email).toEqual(expect.any(String));

    const pending = await f.api().get(`/api/admin/vendors?search=Filter ${unique}&status=PENDING`).set(f.bearer(admin.token));
    expect(pending.body.vendors).toHaveLength(1);
  });

  test("bad filters are 400, a regex in the search is treated as plain text", async () => {
    expect((await f.api().get("/api/admin/vendors?status=NOPE").set(f.bearer(admin.token))).status).toBe(400);
    expect((await f.api().get("/api/admin/vendors?limit=0").set(f.bearer(admin.token))).status).toBe(400);
    const res = await f.api().get("/api/admin/vendors?search=.*").set(f.bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.vendors).toHaveLength(0);
  });

  test("an admin can open one application; an unknown id is 404", async () => {
    const vendor = await f.createVendor();
    const found = await f.api().get(`/api/admin/vendors/${vendor.vendorId}`).set(f.bearer(admin.token));
    expect(found.status).toBe(200);
    expect(found.body.vendor.storeName).toBe(vendor.storeName);
    expect((await f.api().get("/api/admin/vendors/507f1f77bcf86cd799439011").set(f.bearer(admin.token))).status).toBe(404);
  });
});

describe("public stores", () => {
  test("only APPROVED stores are listed or viewable, without private fields", async () => {
    const approved = await f.createVendor({ storeName: `Public ${f.unique()}` });
    const suspended = await f.createVendor({ status: "SUSPENDED" });
    const pending = await f.createVendor({ status: "PENDING" });

    const list = await f.api().get("/api/vendors?limit=50");
    const ids = list.body.vendors.map((v) => v.id);
    expect(ids).toContain(approved.vendorId);
    expect(ids).not.toContain(suspended.vendorId);
    expect(ids).not.toContain(pending.vendorId);
    expect(JSON.stringify(list.body)).not.toMatch(/"user"|status/);

    expect((await f.api().get(`/api/vendors/${approved.vendorId}`)).status).toBe(200);
    expect((await f.api().get(`/api/vendors/${suspended.vendorId}`)).status).toBe(404);
  });

  test("the store list is paginated", async () => {
    const res = await f.api().get("/api/vendors?limit=1&page=1");
    expect(res.body.vendors).toHaveLength(1);
    expect(res.body.pagination.limit).toBe(1);
    expect((await f.api().get("/api/vendors?page=abc")).status).toBe(400);
  });

  test("suspending a vendor hides their products and blocks buying them", async () => {
    const admin = await f.createAdmin();
    const vendor = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(vendor, { name: `Visible ${f.unique()}` });

    const before = await f.api().get(`/api/products?search=${product.name}`);
    expect(before.body.products).toHaveLength(1);
    expect((await f.addToCart(customer, product._id, 1)).status).toBe(201);

    await setStatus(admin, vendor.vendorId, "SUSPENDED");

    const after = await f.api().get(`/api/products?search=${product.name}`);
    expect(after.body.products).toHaveLength(0);
    const newcomer = await f.createUser();
    expect((await f.addToCart(newcomer, product._id, 1)).status).toBe(400);
    const checkout = await f.checkout(customer);
    expect(checkout.status).toBe(400);
    expect(checkout.body.errors[0].message).toMatch(/vendor is not currently active/);
  });
});
