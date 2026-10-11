// Customer journey: cart -> checkout (address) -> payment (failure, retry, success) -> order.
const h = require("../lib/harness");

module.exports = async function customerCheckout({ run, world }) {
  const { check, newPage, uiLogin, visible, absent } = run;
  const customer = await h.registerCustomer("buyer");
  const stranger = await h.registerCustomer("stranger");

  const page = await newPage();
  await uiLogin(page, customer.email);
  await h.call("POST", "/cart/items", { token: customer.token, body: { productId: world.mouse.id, quantity: 1 } });
  await h.call("POST", "/cart/items", { token: customer.token, body: { productId: world.keyboard.id, quantity: 2 } });

  await page.goto(`${h.config.web}/cart`);
  check("cart: shows items grouped by store and the subtotal", (await visible(page, world.vendorA.store)) && (await visible(page, "$90.00")));
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.waitForURL("**/checkout");

  // address validation happens before any request is sent
  let checkoutCalls = 0;
  page.on("request", (r) => { if (r.url().endsWith("/checkout") && r.method() === "POST") checkoutCalls++; });
  check("checkout: no Cash on Delivery wording, card payment explained", (await absent(page, "Cash on Delivery")) && (await visible(page, "You'll pay securely on the next step")));
  await page.getByRole("button", { name: /Place order/ }).click();
  check("checkout: an empty address shows inline errors and sends nothing", (await visible(page, "Phone number is required")) && (await visible(page, "City is required")) && checkoutCalls === 0);
  check("checkout: the first invalid field gets focus", (await page.evaluate(() => document.activeElement && document.activeElement.id)) === "ship-phone");
  await page.locator("#ship-phone").fill("call me");
  await page.locator("#ship-line1").fill("12 Garden Road");
  await page.locator("#ship-city").fill("Lahore");
  await page.locator("#ship-postalCode").fill("!!");
  await page.locator("#ship-country").fill("Pakistan");
  await page.getByRole("button", { name: /Place order/ }).click();
  check("checkout: a bad phone and postal code are explained", (await visible(page, "Enter a valid phone number")) && (await visible(page, "Enter a valid postal code")) && checkoutCalls === 0);

  await page.locator("#ship-phone").fill("+92 300 1234567");
  await page.locator("#ship-postalCode").fill("54000");
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/checkout") && r.request().method() === "POST"),
    page.getByRole("button", { name: /Place order/ }).click(),
  ]);
  await page.waitForURL("**/pay/*");
  const orderId = page.url().split("/pay/")[1];
  check("checkout: placing the order lands on its payment page", /^[0-9a-f]{24}$/.test(orderId));
  check("payment page: amount, items and shipping address are shown", (await visible(page, "$90.00")) && (await visible(page, world.mouse.name)) && (await visible(page, "12 Garden Road")));
  check("payment page: starts unpaid, not success", (await visible(page, "Unpaid")) && (await absent(page, "Payment successful")));

  await Promise.all([page.waitForResponse((r) => r.url().endsWith("/payments/create")), page.getByRole("button", { name: "Continue to payment" }).click()]);
  check("payment: a pending payment shows the test-mode panel", (await visible(page, "Test mode")) && (await visible(page, "Pay $90.00")));
  await page.reload();
  check("payment: the pending state survives a refresh", (await visible(page, "Test mode")) && (await absent(page, "Payment successful")));

  await Promise.all([page.waitForResponse((r) => r.url().endsWith("/payments/verify")), page.getByRole("button", { name: "Simulate a declined payment" }).click()]);
  check("payment: a declined card shows 'Payment failed'", await visible(page, "Payment failed"));
  check("payment: a failed payment leaves the order PENDING", (await h.call("GET", `/orders/${orderId}`, { token: customer.token })).data.order.status === "PENDING");

  await page.getByRole("button", { name: "Try again" }).click();
  check("payment: Try again opens a fresh pending payment", await visible(page, "Test mode"));
  await Promise.all([page.waitForResponse((r) => r.url().endsWith("/payments/verify")), page.getByRole("button", { name: "Pay $90.00" }).click()]);
  check("payment: success is shown only after the backend confirms", await visible(page, "Payment successful"));
  const paid = (await h.call("GET", `/orders/${orderId}`, { token: customer.token })).data.order;
  check("backend: the order is CONFIRMED and PAID", paid.status === "CONFIRMED" && paid.paymentStatus === "PAID");

  await page.getByRole("link", { name: "View order" }).click();
  await page.waitForURL(`**/orders/${orderId}`);
  check("order detail: status, payment and shipping address are shown, no Pay now", (await visible(page, "Confirmed")) && (await visible(page, "12 Garden Road")) && (await absent(page, "Pay now")));

  // the URL is never trusted
  const unpaid = await h.placeOrder(customer.token, [[world.mouse.id, 1]]);
  await page.goto(`${h.config.web}/pay/${unpaid.id}?status=success&payment=PAID`);
  check("security: a forged ?status=success in the URL does not show success", (await visible(page, "Continue to payment")) && (await absent(page, "Payment successful")));
  await page.goto(`${h.config.web}/orders`);
  check("orders: the list shows both Paid and Unpaid badges", (await visible(page, "Paid")) && (await visible(page, "Unpaid")));

  const other = await newPage();
  await uiLogin(other, stranger.email);
  await other.goto(`${h.config.web}/pay/${orderId}`);
  check("security: another customer cannot open someone else's payment page", await visible(other, "could not be found"));

  // an admin-cancelled order cannot be paid
  const doomed = await h.placeOrder(customer.token, [[world.keyboard.id, 1]]);
  await h.call("PATCH", `/admin/orders/${doomed.id}/status`, { token: world.adminToken, body: { status: "CANCELLED" } });
  await page.goto(`${h.config.web}/pay/${doomed.id}`);
  check("payment: a cancelled order shows 'Order cancelled' and no pay button", (await visible(page, "Order cancelled")) && (await absent(page, "Continue to payment")));

  world.customer = customer;
};
