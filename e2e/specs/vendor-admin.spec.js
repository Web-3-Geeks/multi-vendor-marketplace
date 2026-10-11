// Vendor fulfilment and admin moderation, including the confirmation prompts.
const h = require("../lib/harness");

module.exports = async function vendorAdmin({ run, world }) {
  const { check, newPage, uiLogin, visible } = run;
  const buyer = await h.registerCustomer("vbuyer");
  const paidOrder = await h.placeOrder(buyer.token, [[world.keyboard.id, 1]]);
  await h.payOrder(buyer.token, paidOrder.id);
  const unpaidOrder = await h.placeOrder(buyer.token, [[world.keyboard.id, 1]]);

  // ---------- vendor ----------
  const v = await newPage();
  await uiLogin(v, world.vendorB.email);
  await v.waitForURL("**/vendor");
  check("vendor: the dashboard lists their product", await visible(v, world.keyboard.name));
  check("vendor: an unpaid order says 'Awaiting payment' and cannot be advanced", await visible(v, "Awaiting payment"));

  await Promise.all([
    v.waitForResponse((r) => r.url().includes("/vendor/orders/") && r.request().method() === "PATCH"),
    v.getByRole("button", { name: /Mark as Processing/ }).first().click(),
  ]);
  check("vendor: advancing a paid order shows a success message", await visible(v, "marked as Processing"));

  let patchCalls = 0;
  v.on("request", (r) => { if (r.method() === "PATCH" && r.url().includes("/vendor/orders/")) patchCalls++; });
  await v.getByRole("button", { name: "Cancel", exact: true }).first().click();
  check("vendor: cancelling asks for confirmation first", await v.getByRole("dialog").isVisible());
  await v.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  check("vendor: dismissing the dialog sends nothing", patchCalls === 0 && (await v.getByRole("dialog").count()) === 0);

  let deleteCalls = 0;
  v.on("request", (r) => { if (r.method() === "DELETE" && r.url().includes("/vendor/products/")) deleteCalls++; });
  await v.getByRole("button", { name: `Archive ${world.keyboard.name}` }).click();
  check("vendor: archiving a product asks for confirmation first", (await v.getByRole("dialog").getByText("Archive this product?").isVisible()) && deleteCalls === 0);
  await v.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  // ---------- admin ----------
  const a = await newPage();
  await uiLogin(a, h.config.adminEmail, h.config.adminPassword);
  await a.waitForURL("**/admin");

  const vendorsPanel = a.locator("section").filter({ has: a.getByRole("heading", { name: "Vendor applications" }) });
  await a.locator("#admin-vendor-search").fill(world.vendorB.store);
  await Promise.all([a.waitForResponse((r) => r.url().includes("/admin/vendors?")), a.locator("#admin-vendor-search").press("Enter")]);
  const row = vendorsPanel.locator("li", { hasText: world.vendorB.store });
  await row.waitFor();
  await row.getByRole("button", { name: "Suspend" }).click();
  check("admin: suspending a store asks for confirmation", await a.getByRole("dialog").getByText("Suspend this store?").isVisible());
  await a.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  check("admin: cancelling leaves the store approved", (await h.call("GET", `/admin/vendors/${world.vendorB.vendorId}`, { token: world.adminToken })).data.vendor.status === "APPROVED");
  await row.getByRole("button", { name: "Suspend" }).click();
  await Promise.all([
    a.waitForResponse((r) => r.url().includes("/admin/vendors/") && r.request().method() === "PATCH"),
    a.getByRole("dialog").getByRole("button", { name: "Suspend", exact: true }).click(),
  ]);
  check("admin: confirming suspends the store with a success message", await visible(a, "is now suspended"));
  await row.getByRole("button", { name: "Approve" }).click();
  check("admin: approving needs no confirmation", await visible(a, "is now approved"));

  // moderation: take a product down, it leaves the marketplace, restore brings it back
  const productPanel = a.locator("section").filter({ has: a.getByRole("heading", { name: "Products", exact: true }) });
  await a.locator("#admin-product-search").fill(world.mouse.name);
  await Promise.all([a.waitForResponse((r) => r.url().includes("/admin/products?")), a.locator("#admin-product-search").press("Enter")]);
  const prow = productPanel.locator("li", { hasText: world.mouse.name });
  await prow.waitFor();
  await prow.getByRole("button", { name: "Take down" }).click();
  await Promise.all([
    a.waitForResponse((r) => r.url().includes("/admin/products/") && r.request().method() === "PATCH"),
    a.getByRole("dialog").getByRole("button", { name: "Take down", exact: true }).click(),
  ]);
  check("admin: taking a product down shows a success message", await visible(a, "was taken down"));
  const search = `/products?search=${encodeURIComponent(world.mouse.name)}`;
  check("admin: a taken-down product disappears from the public marketplace", (await h.call("GET", search)).data.products.length === 0);
  await a.locator("#admin-product-status").selectOption("ARCHIVED");
  await a.waitForResponse((r) => r.url().includes("status=ARCHIVED"));
  await productPanel.locator("li", { hasText: world.mouse.name }).getByRole("button", { name: "Restore" }).click();
  check("admin: restoring puts it back on the marketplace", (await visible(a, "was restored")) && (await h.call("GET", search)).data.products.length === 1);

  // orders: cancel confirmation + activity timeline
  const ordersPanel = a.locator("section").filter({ has: a.getByRole("heading", { name: "Orders", exact: true }) }).first();
  await a.locator("#admin-order-search").fill(unpaidOrder.id.slice(-8));
  await Promise.all([a.waitForResponse((r) => r.url().includes("/admin/orders?")), a.locator("#admin-order-search").press("Enter")]);
  const orow = ordersPanel.locator("li", { hasText: unpaidOrder.id.slice(-8).toUpperCase() });
  await orow.waitFor();
  await orow.getByRole("button", { name: "Cancel" }).click();
  check("admin: cancelling an order asks for confirmation", await a.getByRole("dialog").getByText("Cancel this order?").isVisible());
  await a.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  check("admin: dismissing it leaves the order alone", (await h.call("GET", `/admin/orders/${unpaidOrder.id}`, { token: world.adminToken })).data.order.status === "PENDING");
  await orow.getByRole("button", { name: "Cancel" }).click();
  await Promise.all([
    a.waitForResponse((r) => r.url().includes("/admin/orders/") && r.request().method() === "PATCH"),
    a.getByRole("dialog").getByRole("button", { name: "Cancel order" }).click(),
  ]);
  check("admin: confirming cancels the order", await visible(a, "marked as Cancelled"));

  await a.locator("#admin-order-search").fill(paidOrder.id.slice(-8));
  await Promise.all([a.waitForResponse((r) => r.url().includes("/admin/orders?")), a.locator("#admin-order-search").press("Enter")]);
  await ordersPanel.locator("li", { hasText: paidOrder.id.slice(-8).toUpperCase() }).getByRole("button", { name: "Details" }).click();
  const details = a.getByRole("dialog");
  await details.getByText("Payment started for").waitFor();
  const text = (await details.innerText()).replace(/\s+/g, " ");
  check("admin: the order timeline lists payment and status events in plain words", text.includes("Payment started for") && /Payment of \$[\d.]+ confirmed/.test(text) && text.includes("moved from Pending to Confirmed"));
  check("admin: each timeline entry names who did it", text.includes("Payment provider") && text.includes(`${buyer.name} (Customer)`));
  await a.keyboard.press("Escape");

  const activity = a.locator("section").filter({ has: a.getByRole("heading", { name: "Activity log" }) });
  await activity.scrollIntoViewIfNeeded();
  await a.waitForFunction(() => { const s = [...document.querySelectorAll("section")].find((x) => x.textContent.includes("Activity log")); return s && s.querySelectorAll("li").length > 0; });
  check("admin: the activity log has entries", (await activity.locator("li").count()) > 0);
  await a.locator("#admin-activity-from").fill("2999-01-01");
  check("admin: a future date range shows the empty state", await visible(a, "No activity found"));
};
