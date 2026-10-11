// Takes the README screenshots into ../docs/screenshots. Same environment variables as run.js.
//   E2E_ADMIN_PASSWORD=... npm run screenshots
const fs = require("fs");
const path = require("path");
const h = require("./lib/harness");

const OUT = path.join(__dirname, "..", "docs", "screenshots");

async function main() {
  if (!h.config.adminPassword) {
    console.error("Set E2E_ADMIN_PASSWORD (the seeded admin's password).");
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const world = await h.createWorld();
  const buyer = await h.registerCustomer("shopper");
  const paid = await h.placeOrder(buyer.token, [[world.mouse.id, 1], [world.keyboard.id, 2]]);
  await h.payOrder(buyer.token, paid.id);
  await h.call("PATCH", `/vendor/orders/${paid.id}/status`, { token: world.vendorA.token, body: { status: "PROCESSING" } });
  await h.placeOrder(buyer.token, [[world.keyboard.id, 1]]);

  const browser = await h.launch();
  const run = h.createRun(browser);
  const shot = async (page, name, options = {}) => {
    await page.waitForFunction(() => !/Loading/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), ...options });
    console.log("saved", name);
  };

  try {
    const guest = await run.newPage();
    await guest.goto(`${h.config.web}/products`);
    await run.visible(guest, world.mouse.name);
    await shot(guest, "01-marketplace");

    const c = await run.newPage();
    await run.uiLogin(c, buyer.email);
    await h.call("POST", "/cart/items", { token: buyer.token, body: { productId: world.mouse.id, quantity: 1 } });
    await c.goto(`${h.config.web}/checkout`);
    await run.visible(c, "Shipping address");
    await shot(c, "02-checkout-address");

    const second = await h.placeOrder(buyer.token, [[world.mouse.id, 1]]);
    await c.goto(`${h.config.web}/pay/${second.id}`);
    await Promise.all([c.waitForResponse((r) => r.url().endsWith("/payments/create")), c.getByRole("button", { name: "Continue to payment" }).click()]);
    await run.visible(c, "Test mode");
    await shot(c, "03-payment-pending");

    await c.goto(`${h.config.web}/pay/${paid.id}`);
    await run.visible(c, "Payment successful");
    await shot(c, "04-payment-success");

    await c.goto(`${h.config.web}/orders`);
    await run.visible(c, "Paid");
    await shot(c, "05-my-orders");

    const m = await run.newPage({ width: 390, height: 844 });
    await run.uiLogin(m, buyer.email);
    await h.call("POST", "/cart/items", { token: buyer.token, body: { productId: world.keyboard.id, quantity: 1 } });
    await m.goto(`${h.config.web}/checkout`);
    await run.visible(m, "Shipping address");
    await shot(m, "06-checkout-mobile", { fullPage: true });

    const v = await run.newPage({ width: 1280, height: 1100 });
    await run.uiLogin(v, world.vendorA.email);
    await run.visible(v, "Mark as Shipped");
    await shot(v, "07-vendor-dashboard", { fullPage: true });

    const a = await run.newPage({ width: 1280, height: 1100 });
    await run.uiLogin(a, h.config.adminEmail, h.config.adminPassword);
    await a.waitForURL("**/admin");
    await run.visible(a, "Activity log");
    await shot(a, "08-admin-dashboard", { fullPage: true });

    await a.locator("#admin-order-search").fill(paid.id.slice(-8));
    await Promise.all([a.waitForResponse((r) => r.url().includes("/admin/orders?")), a.locator("#admin-order-search").press("Enter")]);
    const ordersPanel = a.locator("section").filter({ has: a.getByRole("heading", { name: "Orders", exact: true }) }).first();
    await ordersPanel.locator("li", { hasText: paid.id.slice(-8).toUpperCase() }).getByRole("button", { name: "Details" }).click();
    await a.getByRole("dialog").getByText("Payment started for").waitFor();
    await shot(a, "09-admin-order-timeline");
    await a.keyboard.press("Escape");

    await a.locator("#admin-order-search").fill(second.id.slice(-8));
    await Promise.all([a.waitForResponse((r) => r.url().includes("/admin/orders?")), a.locator("#admin-order-search").press("Enter")]);
    await ordersPanel.locator("li", { hasText: second.id.slice(-8).toUpperCase() }).getByRole("button", { name: "Cancel" }).first().click();
    await a.getByRole("dialog").getByText("Cancel this order?").waitFor();
    await shot(a, "10-confirm-dialog");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
