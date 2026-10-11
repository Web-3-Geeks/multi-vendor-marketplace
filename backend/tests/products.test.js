const db = require("./helpers/db");
const f = require("./helpers/factory");
const Product = require("../models/Product");

beforeAll(db.connect);
afterAll(db.disconnect);

let vendor;
let admin;
let category;
beforeAll(async () => {
  vendor = await f.createVendor();
  admin = await f.createAdmin();
  category = await f.getCategory();
});

const create = (v, body) => f.api().post("/api/vendor/products").set(f.bearer(v.token)).send(body);
const update = (v, id, body) => f.api().patch(`/api/vendor/products/${id}`).set(f.bearer(v.token)).send(body);
const valid = (over = {}) => ({ name: `Item ${f.unique()}`, description: "Nice thing", price: 19.99, stock: 5, category: String(category._id), ...over });

describe("creating products", () => {
  test("a new product is a DRAFT owned by the vendor, with a unique slug", async () => {
    const res = await create(vendor, valid({ name: "Wireless Mouse" }));
    expect(res.status).toBe(201);
    expect(res.body.product.status).toBe("DRAFT");
    expect(String(res.body.product.vendor)).toBe(vendor.vendorId);
    expect(res.body.product.slug).toMatch(/^wireless-mouse-[0-9a-f]{6}$/);
    const twin = await create(vendor, valid({ name: "Wireless Mouse" }));
    expect(twin.body.product.slug).not.toBe(res.body.product.slug);
  });

  test("a client can't choose the vendor", async () => {
    const other = await f.createVendor();
    const res = await create(vendor, { ...valid(), vendor: other.vendorId });
    expect(String(res.body.product.vendor)).toBe(vendor.vendorId);
  });

  test("it can be published straight away when it has a description", async () => {
    const res = await create(vendor, valid({ status: "ACTIVE" }));
    expect(res.status).toBe(201);
    expect(res.body.product.status).toBe("ACTIVE");
  });

  test("publishing without a description is refused with a per-field error", async () => {
    const res = await create(vendor, valid({ status: "ACTIVE", description: "" }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("description");
  });

  test.each([
    ["price of zero", { price: 0 }],
    ["negative price", { price: -5 }],
    ["price above the maximum", { price: 10000001 }],
    ["price that isn't a number", { price: "cheap" }],
    ["negative stock", { stock: -1 }],
    ["fractional stock", { stock: 1.5 }],
    ["missing name", { name: undefined }],
    ["blank name", { name: "  " }],
    ["name too long", { name: "x".repeat(151) }],
    ["missing category", { category: undefined }],
    ["category that isn't an id", { category: "abc" }],
    ["more than 5 images", { images: ["a", "b", "c", "d", "e", "f"].map((x) => `https://example.com/${x}.png`) }],
    ["an image that isn't a URL", { images: ["nope"] }],
    ["a status vendors can't set", { status: "OUT_OF_STOCK" }],
    ["name as an object", { name: { $ne: "" } }],
  ])("rejects %s with 400", async (_label, patch) => {
    const res = await create(vendor, valid(patch));
    expect(res.status).toBe(400);
  });

  test("a category that doesn't exist is rejected", async () => {
    const res = await create(vendor, valid({ category: "507f1f77bcf86cd799439011" }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Category does not exist");
  });
});

describe("stock and status", () => {
  test("zero stock flips an ACTIVE product to OUT_OF_STOCK, restocking flips it back", async () => {
    const product = await f.createProduct(vendor, { stock: 3 });
    const sold = await update(vendor, product._id, { stock: 0 });
    expect(sold.body.product.status).toBe("OUT_OF_STOCK");
    const restocked = await update(vendor, product._id, { stock: 10 });
    expect(restocked.body.product.status).toBe("ACTIVE");
  });

  test("a DRAFT with no stock stays a DRAFT", async () => {
    const res = await create(vendor, valid({ stock: 0 }));
    expect(res.body.product.status).toBe("DRAFT");
  });

  test("editing a live product can't blank its description", async () => {
    const product = await f.createProduct(vendor);
    const res = await update(vendor, product._id, { description: "" });
    expect(res.status).toBe(400);
  });

  test("renaming gives it a new slug", async () => {
    const product = await f.createProduct(vendor, { name: "Old Name" });
    const res = await update(vendor, product._id, { name: "Brand New Name" });
    expect(res.body.product.slug).toMatch(/^brand-new-name-/);
  });

  test("archiving is a soft delete: the row stays, the marketplace stops showing it", async () => {
    const product = await f.createProduct(vendor, { name: `Archive Me ${f.unique()}` });
    const res = await f.api().delete(`/api/vendor/products/${product._id}`).set(f.bearer(vendor.token));
    expect(res.status).toBe(200);
    expect(res.body.product.status).toBe("ARCHIVED");
    expect(await Product.findById(product._id)).not.toBeNull();
    expect((await f.api().get(`/api/products/${product._id}`)).status).toBe(404);
  });
});

describe("ownership", () => {
  let product;
  let intruder;
  beforeAll(async () => {
    product = await f.createProduct(vendor);
    intruder = await f.createVendor();
  });

  test("another vendor gets 404 (never 403) for read, update and archive", async () => {
    expect((await f.api().get(`/api/vendor/products/${product._id}`).set(f.bearer(intruder.token))).status).toBe(404);
    expect((await update(intruder, product._id, { price: 1 })).status).toBe(404);
    expect((await f.api().delete(`/api/vendor/products/${product._id}`).set(f.bearer(intruder.token))).status).toBe(404);
    expect((await Product.findById(product._id)).price).toBe(10);
  });

  test("the owner can read it", async () => {
    const res = await f.api().get(`/api/vendor/products/${product._id}`).set(f.bearer(vendor.token));
    expect(res.status).toBe(200);
    expect(res.body.product.category.name).toEqual(expect.any(String));
  });

  test("a bad product id is a 400, an unknown one a 404", async () => {
    expect((await f.api().get("/api/vendor/products/not-an-id").set(f.bearer(vendor.token))).status).toBe(400);
    expect((await f.api().get("/api/vendor/products/507f1f77bcf86cd799439011").set(f.bearer(vendor.token))).status).toBe(404);
  });
});

describe("the vendor's product list", () => {
  test("is paginated, searchable, filterable, with store-wide counts", async () => {
    const owner = await f.createVendor();
    for (let i = 1; i <= 7; i += 1) await f.createProduct(owner, { name: `Listed ${i}` });
    await f.createProduct(owner, { name: "Sold out", stock: 0, status: "OUT_OF_STOCK" });
    await f.createProduct(owner, { name: "Draft one", status: "DRAFT" });

    const page = await f.api().get("/api/vendor/products?limit=4&page=2").set(f.bearer(owner.token));
    expect(page.status).toBe(200);
    expect(page.body.products).toHaveLength(4);
    expect(page.body.pagination).toMatchObject({ page: 2, limit: 4, total: 9, totalPages: 3 });
    expect(page.body.summary).toEqual({ total: 9, active: 7, outOfStock: 1 });

    const filtered = await f.api().get("/api/vendor/products?status=DRAFT").set(f.bearer(owner.token));
    expect(filtered.body.products).toHaveLength(1);
    expect(filtered.body.summary.total).toBe(9);

    const search = await f.api().get("/api/vendor/products?search=Listed 3").set(f.bearer(owner.token));
    expect(search.body.products).toHaveLength(1);

    expect((await f.api().get("/api/vendor/products?search=.*").set(f.bearer(owner.token))).body.products).toHaveLength(0);
  });

  test("only shows the caller's own products", async () => {
    const a = await f.createVendor();
    const b = await f.createVendor();
    await f.createProduct(a, { name: "Only A" });
    const res = await f.api().get("/api/vendor/products").set(f.bearer(b.token));
    expect(res.body.products.some((p) => p.name === "Only A")).toBe(false);
  });

  test.each(["page=0", "limit=0", "limit=51", "limit=abc", "status=BOGUS"])("rejects ?%s with 400", async (query) => {
    expect((await f.api().get(`/api/vendor/products?${query}`).set(f.bearer(vendor.token))).status).toBe(400);
  });
});

describe("the public marketplace", () => {
  let seller;
  let tag;
  beforeAll(async () => {
    tag = f.unique();
    seller = await f.createVendor({ storeName: `Market ${tag}` });
    await f.createProduct(seller, { name: `Cheap ${tag}`, price: 5 });
    await f.createProduct(seller, { name: `Mid ${tag}`, price: 25 });
    await f.createProduct(seller, { name: `Dear ${tag}`, price: 100 });
    await f.createProduct(seller, { name: `Draft ${tag}`, status: "DRAFT" });
    await f.createProduct(seller, { name: `Gone ${tag}`, status: "ARCHIVED" });
    await f.createProduct(seller, { name: `SoldOut ${tag}`, stock: 0, status: "OUT_OF_STOCK" });
  });

  test("lists only ACTIVE products", async () => {
    const res = await f.api().get(`/api/products?search=${tag}&limit=50`);
    const names = res.body.products.map((p) => p.name);
    expect(names.sort()).toEqual([`Cheap ${tag}`, `Dear ${tag}`, `Mid ${tag}`].sort());
  });

  test("the response only holds public fields (vendor store name, no owner details)", async () => {
    const res = await f.api().get(`/api/products?search=Cheap ${tag}`);
    const product = res.body.products[0];
    expect(product.vendor).toEqual({ id: seller.vendorId, storeName: `Market ${tag}`, logo: "" });
    expect(JSON.stringify(res.body)).not.toMatch(/"user"|takenDownByAdmin/);
  });

  test("filters by price range", async () => {
    const res = await f.api().get(`/api/products?search=${tag}&minPrice=10&maxPrice=50`);
    expect(res.body.products.map((p) => p.name)).toEqual([`Mid ${tag}`]);
  });

  test("sorts by price either way and by newest", async () => {
    const asc = await f.api().get(`/api/products?search=${tag}&sort=price_asc`);
    expect(asc.body.products.map((p) => p.price)).toEqual([5, 25, 100]);
    const desc = await f.api().get(`/api/products?search=${tag}&sort=price_desc`);
    expect(desc.body.products.map((p) => p.price)).toEqual([100, 25, 5]);
    const newest = await f.api().get(`/api/products?search=${tag}&sort=newest`);
    expect(newest.body.products[0].name).toBe(`Dear ${tag}`);
  });

  test("filters by vendor and by category", async () => {
    const byVendor = await f.api().get(`/api/products?vendor=${seller.vendorId}&limit=50`);
    expect(byVendor.body.products.every((p) => p.vendor.id === seller.vendorId)).toBe(true);
    const cat = await f.getCategory();
    const bySlug = await f.api().get(`/api/products?category=${cat.slug}&search=${tag}`);
    expect(bySlug.body.products).toHaveLength(3);
    const byId = await f.api().get(`/api/products?category=${cat._id}&search=${tag}`);
    expect(byId.body.products).toHaveLength(3);
    const none = await f.api().get("/api/products?category=no-such-category");
    expect(none.body.products).toHaveLength(0);
  });

  test("paginates", async () => {
    const res = await f.api().get(`/api/products?search=${tag}&limit=2&page=2`);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  test("a regex in the search is plain text", async () => {
    expect((await f.api().get("/api/products?search=.*")).body.products).toHaveLength(0);
  });

  test.each(["sort=bogus", "minPrice=abc", "page=0", "limit=100", "vendor=bad", "minPrice=50&maxPrice=10"])("rejects ?%s with 400", async (query) => {
    expect((await f.api().get(`/api/products?${query}`)).status).toBe(400);
  });

  test("a single product is public only while it is ACTIVE", async () => {
    const live = await f.createProduct(seller);
    const draft = await f.createProduct(seller, { status: "DRAFT" });
    const res = await f.api().get(`/api/products/${live._id}`);
    expect(res.status).toBe(200);
    expect(res.body.product.category.name).toEqual(expect.any(String));
    expect((await f.api().get(`/api/products/${draft._id}`)).status).toBe(404);
    expect((await f.api().get("/api/products/nope")).status).toBe(400);
  });
});

describe("categories", () => {
  test("anyone can list them; only admins can create, edit or delete", async () => {
    const name = `Cat ${f.unique()}`;
    const customer = await f.createUser();
    expect((await f.api().get("/api/categories")).status).toBe(200);
    expect((await f.api().post("/api/categories").set(f.bearer(customer.token)).send({ name })).status).toBe(403);

    const created = await f.api().post("/api/categories").set(f.bearer(admin.token)).send({ name, description: "x" });
    expect(created.status).toBe(201);
    expect(created.body.category.slug).toBe(name.toLowerCase().replace(/\s+/g, "-"));
    const id = created.body.category._id;

    const renamed = await f.api().patch(`/api/categories/${id}`).set(f.bearer(admin.token)).send({ name: `${name} v2` });
    expect(renamed.body.category.slug).toMatch(/v2$/);
    expect((await f.api().patch(`/api/categories/${id}`).set(f.bearer(vendor.token)).send({ name: "x" })).status).toBe(403);
    expect((await f.api().delete(`/api/categories/${id}`).set(f.bearer(admin.token))).status).toBe(200);
  });

  test("names must be unique and valid", async () => {
    const name = `Unique ${f.unique()}`;
    await f.api().post("/api/categories").set(f.bearer(admin.token)).send({ name });
    expect((await f.api().post("/api/categories").set(f.bearer(admin.token)).send({ name })).status).toBe(409);
    expect((await f.api().post("/api/categories").set(f.bearer(admin.token)).send({ name: "  " })).status).toBe(400);
    expect((await f.api().post("/api/categories").set(f.bearer(admin.token)).send({ name: { $ne: 1 } })).status).toBe(400);
  });

  test("a category still used by products can't be deleted", async () => {
    const res = await f.api().delete(`/api/categories/${category._id}`).set(f.bearer(admin.token));
    expect(res.status).toBe(409);
  });

  test("unknown ids are 404", async () => {
    expect((await f.api().delete("/api/categories/507f1f77bcf86cd799439011").set(f.bearer(admin.token))).status).toBe(404);
    expect((await f.api().patch("/api/categories/507f1f77bcf86cd799439011").set(f.bearer(admin.token)).send({ name: "x" })).status).toBe(404);
  });
});

describe("admin moderation", () => {
  const takeDown = (id, status = "ARCHIVED") => f.api().patch(`/api/admin/products/${id}/status`).set(f.bearer(admin.token)).send({ status });

  test("an admin can take a product down and restore it", async () => {
    const product = await f.createProduct(vendor, { name: `Moderated ${f.unique()}` });
    const down = await takeDown(product._id);
    expect(down.status).toBe(200);
    expect(down.body.product).toMatchObject({ status: "ARCHIVED", takenDownByAdmin: true });
    expect((await f.api().get(`/api/products/${product._id}`)).status).toBe(404);

    const up = await takeDown(product._id, "ACTIVE");
    expect(up.body.product).toMatchObject({ status: "ACTIVE", takenDownByAdmin: false });
    expect((await f.api().get(`/api/products/${product._id}`)).status).toBe(200);
  });

  test("the vendor can't publish a product an admin took down, but can still edit it", async () => {
    const product = await f.createProduct(vendor);
    await takeDown(product._id);
    const publish = await update(vendor, product._id, { status: "ACTIVE" });
    expect(publish.status).toBe(403);
    expect(publish.body.message).toMatch(/taken down by an admin/);
    expect((await update(vendor, product._id, { status: "DRAFT" })).status).toBe(403);
    const edit = await update(vendor, product._id, { stock: 99, status: "ARCHIVED" });
    expect(edit.status).toBe(200);
    expect(edit.body.product.stock).toBe(99);
  });

  test("an admin can't restore a product that has no description or whose store isn't approved", async () => {
    const noDescription = await f.createProduct(vendor, { description: " " });
    await Product.updateOne({ _id: noDescription._id }, { status: "ARCHIVED" });
    expect((await takeDown(noDescription._id, "ACTIVE")).status).toBe(400);

    const suspended = await f.createVendor({ status: "SUSPENDED" });
    const product = await f.createProduct(suspended, { status: "ARCHIVED" });
    const res = await takeDown(product._id, "ACTIVE");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not approved/);
  });

  test("only ACTIVE and ARCHIVED are accepted, ids are validated, vendors can't moderate", async () => {
    const product = await f.createProduct(vendor);
    expect((await takeDown(product._id, "DRAFT")).status).toBe(400);
    expect((await takeDown("not-an-id")).status).toBe(400);
    expect((await takeDown("507f1f77bcf86cd799439011")).status).toBe(404);
    const asVendor = await f.api().patch(`/api/admin/products/${product._id}/status`).set(f.bearer(vendor.token)).send({ status: "ARCHIVED" });
    expect(asVendor.status).toBe(403);
  });

  test("the admin list shows every status with vendor and category, and filters", async () => {
    const tag = f.unique();
    const owner = await f.createVendor();
    await f.createProduct(owner, { name: `AdminList ${tag} live` });
    await f.createProduct(owner, { name: `AdminList ${tag} draft`, status: "DRAFT" });

    const all = await f.api().get(`/api/admin/products?search=AdminList ${tag}`).set(f.bearer(admin.token));
    expect(all.body.products).toHaveLength(2);
    expect(all.body.products[0].vendor.storeName).toBe(owner.storeName);
    expect(all.body.products[0].category.name).toEqual(expect.any(String));

    const drafts = await f.api().get(`/api/admin/products?search=AdminList ${tag}&status=DRAFT`).set(f.bearer(admin.token));
    expect(drafts.body.products).toHaveLength(1);
    const byVendor = await f.api().get(`/api/admin/products?vendor=${owner.vendorId}&limit=1`).set(f.bearer(admin.token));
    expect(byVendor.body.pagination.total).toBe(2);
    expect((await f.api().get("/api/admin/products?status=NOPE").set(f.bearer(admin.token))).status).toBe(400);
  });
});
