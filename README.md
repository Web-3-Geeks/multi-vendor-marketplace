# MarketHub: Multi-Vendor Marketplace

A full-stack marketplace where customers shop, vendors sell, and admins run the platform. Each role gets exactly the access it needs, and every permission is enforced on the backend.

This project is built one day at a time. Each day adds to the same codebase. Snapshots of the project at the end of each day live in `week6/DayN/`.

## Live links

| | URL |
|---|---|
| Frontend | https://multi-vendor-marketplace-weld.vercel.app |
| Backend API | https://multi-vendor-marketplace-api.vercel.app/api |
| Health check | https://multi-vendor-marketplace-api.vercel.app/api/health |

**Demo accounts:** anyone can sign up as a customer. Demo admin and vendor credentials are shared privately with the reviewer and are not stored in this repository.

**API testing:** a ready-to-import Postman collection covering every endpoint is at [`postman/MarketHub-API.postman_collection.json`](postman/MarketHub-API.postman_collection.json). Set its `baseUrl` variable, then log in once per role (Admin/Vendor logins auto-save their token).

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Node.js, Express 5, MongoDB Atlas, Mongoose 9, JWT, bcrypt, express-validator |
| Frontend | React 19, Vite, React Router 7, Tailwind CSS 4, lucide-react |
| Hosting | Vercel (backend and frontend as separate projects) |

## Project structure

```
backend/
  server.js              App setup: CORS, JSON parsing, routes, 404, error handler, DB connection
  constants/              Roles and the vendor/product/order/payment/commission statuses -- each in one place
  models/
    User.js               Password hashing, password comparison
    Vendor.js              One store per user, status PENDING/APPROVED/SUSPENDED/REJECTED
    Category.js            Unique name + slug
    Product.js              Belongs to a vendor and a category; auto DRAFT<->ACTIVE<->OUT_OF_STOCK
    Cart.js, CartItem.js    One cart per user; one row per product in that cart (unique index)
    Order.js, OrderItem.js  OrderItem snapshots productName/unitPrice; carries its own fulfillment status
    Payment.js              One row per payment attempt; unique transactionId; refund details; processed webhook event ids
    Commission.js           One row per order item: gross, rate (snapshot), commission, vendor amount, status
    MockTransaction.js      The mock payment provider's own records (stands in for the provider's database)
  services/
    cartService.js          Builds the cart response (vendor-grouped, with per-item availability issues)
    orderService.js         Checkout (the transaction), status-transition rules, cancel + stock release, stale-order cleanup
    paymentService.js       Create/verify/webhook/refund; the single settlePayment transaction behind verify AND webhook
    commissionService.js    Reads COMMISSION_RATE, creates and updates commission rows
    payment/                Provider interface (createIntent, retrieve, refund, verifyWebhook) + the mock provider
  utils/slugify.js, uniqueSlug.js   URL-friendly slugs; products get a random suffix to avoid clashes
  utils/money.js, escapeRegex.js, dateRange.js   Rounding, safe regex search, from/to date filters
  validators/             Request validation rules, one file per resource
  middleware/
    validate.js            Returns 400 with per-field errors if validation fails
    auth.js                authenticate (401) and requireRole (403)
    loadVendor.js           Loads the caller's store, 403s if it isn't APPROVED
    errorHandler.js         Central error handler (also maps duplicate keys and bad ids to 409/400)
  controllers/, routes/   One pair per resource: auth, vendors, admin vendor management, categories,
                          vendor's own products, the public product catalog, cart, checkout,
                          customer orders, vendor orders, payments, vendor earnings,
                          admin payments, admin orders, admin stats
  scripts/seed.js         Creates the demo vendor (with an APPROVED store) and admin

frontend/src/
  lib/api.js, format.js   One function for every API call; price/date/stock formatting
  hooks/useApi.js         Generic GET hook: loading/error/data + a reload() for after a mutation
  context/, hooks/        Auth state (AuthProvider/useAuth) and cart state (CartProvider/useCart)
  components/routing/    ProtectedRoute and GuestRoute
  components/ui/         TextField, Select, TextArea, Button, Modal, Badge, Alert, Spinner,
                          QuantityStepper...
  components/dashboard/  Layout, sidebar and dashboard widgets
  components/marketplace/ Public header/layout, product card, filters, pagination
  components/vendor/     Become-a-vendor form, product add/edit modal, product table row,
                          vendor order-management panel, vendor earnings panel
  components/admin/      Vendor application review, category CRUD, marketplace stats,
                          orders panel, payments panel (with refund)
  components/cart/, components/orders/   Cart item row; the reusable recent-orders list
  pages/                 Login, Register, three role dashboards, the public marketplace pages,
                          cart, checkout, payment, and order history/detail
```

## Running locally

You need Node.js 20+ and a MongoDB connection string (a free MongoDB Atlas cluster works).

### Backend

```bash
cd backend
npm install
cp .env.example .env    # then fill in the values
npm run seed            # creates the demo vendor and admin
npm run dev             # http://localhost:5000
```

`backend/.env`:

| Variable | Purpose |
|---|---|
| `PORT` | Local port, defaults to 5000 |
| `DATABASE_URL` | MongoDB connection string, including the database name |
| `JWT_SECRET` | Long random string used to sign tokens |
| `FRONTEND_URL` | The only origin CORS allows, e.g. `http://localhost:5173` (no trailing slash) |
| `BACKEND_URL` | The API's own base URL |
| `PAYMENT_PROVIDER` | `mock` for development. Picks the provider in `services/payment/` |
| `PAYMENT_PUBLIC_KEY` | Provider public key (safe to send to the browser) |
| `PAYMENT_SECRET_KEY` | Provider secret key. Server only, never returned by any endpoint |
| `PAYMENT_WEBHOOK_SECRET` | Shared secret used to sign and verify webhook calls. Use a long random string |
| `COMMISSION_RATE` | Platform commission as a fraction, e.g. `0.10` for 10%. Defaults to `0.10` |
| `SEED_ADMIN_PASSWORD` | Password for `admin@test.com`, used only by `npm run seed` |
| `SEED_VENDOR_PASSWORD` | Password for `vendor@test.com`, used only by `npm run seed` |

The server refuses to start if a required variable (including the four `PAYMENT_*` ones) is missing, or if `COMMISSION_RATE` is not between 0 and 1. Generate the webhook secret with `node -e "console.log('whsec_' + require('crypto').randomBytes(32).toString('hex'))"`.

The seed script skips accounts that already exist, so it is safe to run more than once. To change a seeded password, delete that user and run the seed again.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:5000/api
npm run dev             # http://localhost:5173
```

`VITE_API_URL` is built into the browser bundle, so it is public. Never put a secret in the frontend `.env`.

## API

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Returns `{ "status": "ok" }` |
| POST | `/api/auth/register` | Public | Creates a customer account |
| POST | `/api/auth/login` | Public | Returns a JWT and the user |
| POST | `/api/auth/logout` | Public | Acknowledges logout (see "Logout" below) |
| GET | `/api/auth/me` | Logged in | Returns the current user |
| GET | `/api/customer/dashboard` | CUSTOMER | Demo protected route |
| GET | `/api/vendor/dashboard` | VENDOR | Demo protected route |
| GET | `/api/admin/dashboard` | ADMIN | Demo protected route |
| POST | `/api/vendors` | CUSTOMER | Submit a vendor application (status starts `PENDING`) |
| GET | `/api/vendors/me` | Logged in | The caller's own vendor application, or `null` |
| GET | `/api/vendors` | Public | List approved stores |
| GET | `/api/vendors/:id` | Public | One approved store's public info |
| GET | `/api/admin/vendors` | ADMIN | List vendor applications, optional `?status=` filter |
| GET | `/api/admin/vendors/:id` | ADMIN | One vendor application |
| PATCH | `/api/admin/vendors/:id/status` | ADMIN | Set `APPROVED`, `REJECTED` or `SUSPENDED` |
| GET | `/api/categories` | Public | List categories |
| POST | `/api/categories` | ADMIN | Create a category (slug is generated from the name) |
| PATCH | `/api/categories/:id` | ADMIN | Update a category |
| DELETE | `/api/categories/:id` | ADMIN | Delete, blocked with 409 if a product still uses it |
| POST | `/api/vendor/products` | VENDOR, approved store | Create a product (defaults to `DRAFT`) |
| GET | `/api/vendor/products` | VENDOR, approved store | List the caller's own products, optional `?status=` |
| GET \| PATCH | `/api/vendor/products/:id` | VENDOR, approved store | Read or update **your own** product only |
| DELETE | `/api/vendor/products/:id` | VENDOR, approved store | Archive (soft delete) your own product |
| GET | `/api/products` | Public | Active products only. `?search=&category=&vendor=&minPrice=&maxPrice=&sort=&page=&limit=` |
| GET | `/api/products/:id` | Public | One active product, with its vendor and category |
| GET | `/api/cart` | Logged in | The caller's cart, grouped by vendor, with per-item `issue` warnings |
| POST | `/api/cart/items` | Logged in | Add a product (merges into the existing row if it's already there) |
| PATCH | `/api/cart/items/:id` | Logged in | Change an item's quantity |
| DELETE | `/api/cart/items/:id` | Logged in | Remove an item |
| POST | `/api/checkout` | Logged in | Re-validates the whole cart and creates the order, atomically |
| GET | `/api/orders` | Logged in | The caller's own orders |
| GET | `/api/orders/:id` | Logged in | One of the caller's own orders, with its items |
| GET | `/api/vendor/orders` | VENDOR, approved store | Orders containing this vendor's products, **their items only** |
| GET | `/api/vendor/orders/:id` | VENDOR, approved store | Same scoping, for one order |
| PATCH | `/api/vendor/orders/:id/status` | VENDOR, approved store | Advance or cancel this vendor's segment of the order |
| POST | `/api/payments/create` | Logged in | Start (or resume) a payment for one of **your** orders. Only the order id is sent; the amount comes from the order |
| GET | `/api/payments/order/:orderId` | Logged in | Your latest payment attempt for that order, or `{ payment: null }` |
| POST | `/api/payments/verify` | Logged in | Asks the provider for the real status, checks amount + order, then settles the payment |
| POST | `/api/payments/webhook` | Provider (signed) | Signature-verified, idempotent payment events. No login: the signature is the authentication |
| POST | `/api/payments/mock/pay` | Logged in, `PAYMENT_PROVIDER=mock` only | Development stand-in for the customer paying on the provider's page |
| GET | `/api/vendor/earnings` | VENDOR, approved store | Summary (sales, commission, net, paid, pending) + paginated history, `?status=&from=&to=&page=&limit=` |
| GET | `/api/admin/payments` | ADMIN | List payments, `?search=` (transaction id) `&status=&from=&to=&page=&limit=` |
| GET | `/api/admin/payments/:id` | ADMIN | One payment with its customer, order and items |
| POST | `/api/admin/payments/:id/refund` | ADMIN | Provider refund, then marks payment/order/commissions. Body `{ reason? }` |
| GET | `/api/admin/orders` | ADMIN | All orders, `?search=&status=&paymentStatus=&page=&limit=` |
| GET | `/api/admin/orders/:id` | ADMIN | One order with customer, items and every payment attempt |
| PATCH | `/api/admin/orders/:id/status` | ADMIN | Move a paid order forward one step, or cancel an unpaid one |
| GET | `/api/admin/stats` | ADMIN | Dashboard totals: orders, paid/pending/failed, sales, commission, vendor earnings |

The webhook is the one route that receives the raw, unparsed body, because its signature is computed over the exact bytes the provider sent.

Protected requests send `Authorization: Bearer <token>`. Cart, checkout and orders are open to any authenticated role (Customer, Vendor or Admin) -- there's no `requireRole` on them, matching Day 1's RBAC table, which allows "Place orders" for all three.

**Status codes used consistently:**

| Code | Meaning |
|---|---|
| 400 | Validation failed, or a URL id isn't a valid Mongo id. Body has `errors: [{ field, message }]` where relevant |
| 401 | Not logged in: token missing, invalid, expired, or user no longer exists |
| 403 | Logged in, but the role (or vendor approval status) doesn't allow this |
| 404 | Route not found, or found but not yours (vendors never get a 403 for another vendor's product -- see "Key decisions") |
| 409 | A unique field (email, category name/slug, product slug) is already in use, or a category is still used by products |
| 500 | Unexpected error. Details are logged on the server, not sent to the client |

---

## Day 1: Setup, authentication and RBAC

### What was built

**Backend**
- Express app with MongoDB Atlas, environment variables, CORS restricted to the frontend's URL, a health check, a JSON 404 handler and a central error handler. The server refuses to start if `DATABASE_URL`, `JWT_SECRET` or `FRONTEND_URL` is missing, and it does not send the `X-Powered-By` header.
- `User` model with name, email (unique, lowercased), password (bcrypt-hashed, hidden from queries by default), role (`CUSTOMER`, `VENDOR` or `ADMIN`, defaulting to `CUSTOMER`) and timestamps.
- Register, login, logout and `/me` endpoints with validation. Every field must be a string (objects and arrays are rejected with 400), the name is at most 100 characters, the email must be valid and at most 254 characters, and the password must be 8 to 72 characters with a letter and a number. The 72 limit is bcrypt's: it ignores anything after 72 bytes.
- `authenticate` middleware (verifies the JWT, its expiry and that the user still exists) and a reusable `requireRole(...roles)` middleware.
- Three role dashboards on the API, each limited to one role.
- A seed script for the first vendor and admin.

**Frontend**
- Login and register pages with per-field validation errors, a form-level error message and loading states.
- Auth state in React Context, with the token kept in `localStorage` so a refresh keeps you logged in.
- `ProtectedRoute` (requires login and the right role) and `GuestRoute` (sends logged-in users away from login and register).
- One dashboard per role, showing the user's role, account details and which features their role allows.
- Logout from the sidebar, which also works in the mobile menu.

### Key decisions and why

**The role is never taken from the client.**
Register reads only `name`, `email` and `password` from the request, so sending `"role": "ADMIN"` has no effect. The JWT holds only the user's id. On every protected request, `authenticate` loads the user from the database and the role comes from there. If an admin changes someone's role, it takes effect on their next request instead of when their token expires.

**Admins and vendors are not created through sign-up.**
Self-service admin access would be a security hole, and open vendor sign-up would let anyone list products without checks. The first admin and vendor come from the seed script. The seed passwords are read from `.env`, so they are never in the repository. The planned flow for vendors is: a customer applies, an admin approves, and the role becomes `VENDOR`. That is why `Vendor` will be its own collection later rather than more fields on `User`.

**401 and 403 mean different things.**
`authenticate` answers "who are you?" and returns 401 when it cannot tell. `requireRole` answers "are you allowed?" and returns 403 when the answer is no. Controllers only run after both have passed, so they never repeat permission checks.

**Frontend route guards are for user experience. The backend is the security.**
`ProtectedRoute` stops a customer from seeing the admin page by typing `/admin`, but frontend code can be changed by the user. The real protection is `requireRole` on the API, which returns 403 no matter how the request is made.

**The token is stored in `localStorage` and sent as a Bearer header, not in an httpOnly cookie.**
An httpOnly cookie is safer against XSS. But the frontend and backend are on different Vercel domains, and cross-site cookies need extra configuration and are blocked by some browsers. To reduce the XSS risk: React escapes rendered text, the app does not use `dangerouslySetInnerHTML`, and tokens expire after 1 day. If cookies are required later, a Vercel rewrite can put the API on the same domain as the frontend.

**Logout.**
JWTs are stateless, so the server cannot cancel a token it has issued. Logging out removes the token from the browser, and every later request is then unauthenticated. `POST /api/auth/logout` exists for a consistent API and never fails. The limit: a stolen token stays valid until it expires. A token blacklist or a per-user token version can fix this later.

**Login gives the same error for a wrong email and a wrong password.**
"Invalid email or password" in both cases, so the login form cannot be used to find out which emails are registered.

**Duplicate emails are checked twice.**
The register handler checks first to give a clear 409. The unique index in the database is the backup for two sign-ups with the same email at the same moment, and the error handler turns that database error into the same 409.

**No flash of the login page on refresh.**
After a refresh, the app has a token but no user yet. `AuthProvider` sets `initializing` while it calls `/api/auth/me`. The route guards show a loader until that check finishes, instead of redirecting a logged-in user to the login page. The saved token is deleted only when the server answers 401. A network error or a slow server does not throw away a valid token, so the next refresh logs the user back in.

**One function for all API calls.**
`fetch` does not throw on 4xx or 5xx responses. `apiRequest` throws an error with the server's `message`, the `status` and the per-field `errors`, so every form handles errors the same way.

**Deployment.**
Backend and frontend are separate Vercel projects from the same repository (root directories `backend` and `frontend`). Vercel's Express preset runs `server.js` as it is. `frontend/vercel.json` sends every path to `index.html`, so opening or refreshing `/admin` works with client-side routing.

### Testing done

- **API:** register, login and `/me` with valid, missing, malformed, tampered and expired tokens, and a token for a deleted user. A full role-by-dashboard matrix: each role gets 200 on its own dashboard and 403 on the other two. Malformed input (objects or arrays instead of strings, a 90,000-character name, a 73-character password, broken JSON) returns 400, not 500.
- **Browser:** 26 automated end-to-end checks run in Microsoft Edge, both locally and against the live site. They cover validation errors, wrong password, register then log in, duplicate email, refresh keeping the session, changing the URL to another role's dashboard, logout clearing the token, all three roles, and the mobile menu (including closing it with Escape). Three more checks cover the saved token: kept on a network error, restored on the next refresh, and cleared when the server rejects it.
- `npm run lint` and `npm run build` pass for the frontend.

### Known limitations

- Local development and the live site share one database. A separate development database is planned.
- There is no rate limiting on login yet.
- Tokens cannot be revoked before they expire (see "Logout").
- Login answers slightly faster for an unregistered email, because no password hash is checked. This small timing difference could hint which emails exist.
- Dashboard sections for payments are still placeholders, marked "Soon". Products (Day 2) and orders (Day 3) are no longer placeholders -- see below.

---

## Day 2: Vendor management, products and the marketplace catalog

### What was built

**Backend**
- `Vendor` model: one store per user (`unique` on the user reference), status `PENDING` / `APPROVED` / `SUSPENDED` / `REJECTED`, defaulting to `PENDING`.
- `POST /api/vendors` lets a logged-in `CUSTOMER` apply once; `GET /api/vendors/me` returns the caller's own application (or `null`) so the frontend can show the right screen.
- Admin vendor management: list (with a status filter), get one, and `PATCH .../status` to approve, reject or suspend. Approving or suspending also updates the applicant's `User.role` (see "Key decisions").
- `Category` model with a unique name and slug, admin-only create/update/delete, public read. Deleting a category that's still used by a product is blocked with 409 instead of leaving products pointing at nothing.
- `Product` model: belongs to one `Vendor` and one `Category`, price must be greater than zero, stock can't be negative, slug is unique platform-wide. A `pre("validate")` hook keeps `status` honest: an `ACTIVE` product whose stock hits 0 flips itself to `OUT_OF_STOCK`, and restocking flips it back -- vendors never set `OUT_OF_STOCK` by hand.
- Vendor product CRUD, all scoped to the caller's own store: create, list (with a status filter), read one, update, and archive (soft delete). A product can only become `ACTIVE` if its vendor is approved, the category still exists, and it has a name, price, stock and description.
- Public catalog: `GET /api/products` returns only `ACTIVE` products from `APPROVED` vendors, with search (name or description, case-insensitive, regex-escaped), category (slug or id), vendor, price range, sorting (`newest` / `price_asc` / `price_desc`) and pagination (max 50 per page). `GET /api/products/:id` returns one product with its vendor and category, 404 if it's not active or its vendor isn't approved.
- `loadVendor` middleware and the `CastError` → 400 fix (see "Key decisions") are shared across every resource added this day.

**Frontend**
- Public marketplace, reachable with or without logging in: `/products` (search, category, price range and sort filters that update the list without a page reload, via URL query params so a filtered view is shareable and survives a refresh), `/products/:id` (gallery, description, stock, an "Add to Cart" that was wired up on Day 3), and `/vendor/:id` (a store page listing that vendor's products).
- A "Become a vendor" card on the customer dashboard: an application form if the customer has none yet, or their current status and what it means if they do.
- The vendor dashboard now shows real data: store status (with a plain-English explanation when it's not `APPROVED`), product counts, and -- once approved -- a product table with add/edit (a shared modal), inline stock editing, and archive. Pending or suspended vendors see their status and nothing to manage, since there's nothing to manage yet.
- The admin dashboard gained a vendor-applications panel (tabs by status, approve/reject/suspend buttons that only show where they make sense) and a categories panel (create, inline edit, delete).
- A small `useApi(path)` hook wraps every `GET` used by these pages: loading/error/data plus a `reload()` for after a mutation, so list screens don't each reinvent `useEffect` + `useState`.

### Key decisions and why

**A suspended vendor keeps the `VENDOR` role; a rejected one doesn't.**
The first version of this flipped role to `CUSTOMER` for anything that wasn't `APPROVED`. Testing caught the problem: `ProtectedRoute` requires `VENDOR` to even load `/vendor`, so a suspended vendor demoted to `CUSTOMER` would get redirected to `/customer` before ever seeing *why* -- the "your store is suspended" screen was unreachable. Now suspending keeps `VENDOR` (they can still log in and see their status), while rejecting -- which means they were never approved -- drops back to `CUSTOMER`. Either way, `loadVendor` blocks the actual product endpoints unless the store is `APPROVED`, so the role is about what a vendor can *see*, not what they're allowed to *do* -- that's still enforced by status, same as Day 1's rule that the backend decides access, not the client.

**Ownership is enforced by query, not by checking after the fact.**
A vendor's product routes never do `Product.findById(id)` and then compare `product.vendor` to the caller. They do `Product.findOne({ _id: id, vendor: req.vendor._id })` -- the database itself only returns the row if both match. Try to edit, read or archive another vendor's product and the query finds nothing, so it's a 404, the same as if the id didn't exist at all. A 403 would confirm the product exists and just isn't yours; 404 gives an attacker nothing. The same pattern protects `category` and `vendor` from ever being set by the request body: both models whitelist which fields a request can touch (`EDITABLE_FIELDS` in the product controller), so sending `"vendor": "someone-else's-store-id"` is silently ignored, not an error -- a careless client just doesn't get what it asked for.

**`OUT_OF_STOCK` is computed, not set.**
It's tempting to let the status dropdown include it, but then a vendor could set `ACTIVE` with 50 in stock and `OUT_OF_STOCK` with 50 in stock at the same time -- two fields disagreeing about the same fact. Instead the `Product` schema's `pre("validate")` hook is the single source of truth: stock hits 0 on an `ACTIVE` product, it becomes `OUT_OF_STOCK`; stock comes back, it becomes `ACTIVE` again. The vendor only ever chooses between `DRAFT`, `ACTIVE` and `ARCHIVED`.

**Product slugs get a random suffix; category slugs don't.**
A category's name is already unique, so its slug is too. Two different vendors can both sell something called "iPhone 15 Pro" -- if both slugified to `iphone-15-pro`, the second create would fail with a confusing conflict. `uniqueSlug()` appends 6 random hex characters (`iphone-15-pro-a3f9c1`), so the slug stays readable and still can't collide in practice.

**Archiving is still the only delete.**
Day 1 already decided this for conceptual reasons (products referenced by future orders shouldn't vanish); Day 2 just applies it to the new resource. `DELETE /api/vendor/products/:id` sets `status: ARCHIVED` and the product disappears from the public catalog (it's not `ACTIVE`) without the underlying row -- and its id, which Day 3's cart/order system will reference -- being destroyed.

**Malformed ids are a 400, not a 500.**
Testing `/api/admin/vendors/abc` (a non-id string, not a 404-shaped id) turned up a real bug: Mongoose throws a `CastError` trying to parse `"abc"` as an ObjectId, and the Day 1 error handler didn't recognize it, so it fell through to a generic 500. Fixed once, centrally, in `errorHandler.js` (`err.name === "CastError"` → 400), which fixed every `:id` route added this day for free, including the vendor and product endpoints -- this is why the central error handler exists instead of per-route validation of every id.

**The marketplace is public; the dashboards aren't.**
`/products`, `/products/:id` and `/vendor/:id` sit outside `ProtectedRoute` and `GuestRoute` entirely, under their own `MarketplaceLayout`, with a header that shows Login/Sign up for guests and a Dashboard link for anyone logged in. A shopper shouldn't need an account to browse, same as any real marketplace.

**Filters live in the URL, not just component state.**
`ProductsPage` reads and writes its filters through `useSearchParams` instead of plain `useState`. A filtered, sorted, paginated view is then a real link someone can share or bookmark, survives a refresh, and works with the browser's back button -- all for free, without extra code.

### Testing done

- **API:** the full vendor lifecycle (apply → pending → approve → role becomes `VENDOR` → suspend → role stays `VENDOR` but product routes 403 → re-approve), category CRUD including the in-use-can't-delete case, and product CRUD including the ownership checks (another vendor gets 404, not 403, on your product) and the auto `ACTIVE` ↔ `OUT_OF_STOCK` flip. Malformed ids, missing categories, and non-vendor/non-admin roles hitting the wrong endpoints were all checked for the right 400/403/404.
- **Browser:** 30 automated end-to-end checks in Microsoft Edge covering the public marketplace (search, category filter, price range, sort, pagination, clearing filters), a product detail and its vendor's store page, a brand-new customer applying as a vendor and seeing `Pending`, an admin approving that application and managing categories (including the blocked delete), and the demo vendor publishing a draft product, creating a new one, editing its stock inline, and archiving it -- then confirming a suspended vendor sees the restricted dashboard instead of the product table. Most of the early test failures here were the test's own timing being too optimistic for MongoDB Atlas's network round-trip (500-900ms per request) combined with the 400ms search debounce, not application bugs -- worth noting since it's an easy trap when testing anything that talks to a cloud database.
- `npm run lint` and `npm run build` pass for the frontend.

### Known limitations

- Vendor applications, once rejected, can be reconsidered (set back to `APPROVED`) through the same endpoint a normal approval uses. There's no separate "appeal" flow or history of past decisions -- only the current status is stored.
- The vendor product form accepts image URLs as a comma-separated field rather than a real upload; there's no image hosting in this project yet.
- Search matches `name` and `description` with a case-insensitive substring regex, not a text index -- fine at this scale, would want `$text` or a real search service at catalog sizes in the thousands.
- Local development and the live site still share one Atlas database (see Day 1), so Day 2 testing was done directly against the shared data and cleaned up with a script afterward rather than against an isolated test database.

---

## Day 3: Shopping cart, multi-vendor checkout and order management

### What was built

**Backend**
- `Cart` (one per user) and `CartItem` (one row per product, a unique index on `cart + product` backs up the "merge instead of duplicate" rule at the database level, not just in the controller).
- Cart endpoints re-check the product on every add/update: it must exist, be `ACTIVE`, belong to an `APPROVED` vendor, and have enough stock. `GET /cart` returns items grouped by vendor with subtotals, and flags any item that's gone stale (vendor suspended, stock dropped below what's in the cart) with a plain-English `issue` instead of silently fixing or hiding it.
- `POST /api/checkout` re-validates the entire cart a second time -- fresh from the database, inside a MongoDB transaction -- before creating anything. If the cart is empty, or any item fails (deleted, no longer active, vendor no longer approved, not enough stock), the whole request fails with a 400 and a per-item `errors` list; nothing is created and nothing changes. On success, in the same transaction: the `Order` and its `OrderItem`s are created, each purchased product's stock is decremented (which can trigger the same `OUT_OF_STOCK` auto-flip from Day 2), and the cart is emptied.
- `Order` stores the totals (`subtotal`, `shippingAmount`, `discountAmount`, `taxAmount`, `totalAmount` -- the last three are `0` for now, ready for Day 4). `OrderItem` stores a snapshot of `productName` and `unitPrice` at purchase time, plus the `vendor` reference and its own fulfillment `status`.
- Customers can list and view their own orders (`GET /api/orders`, `/api/orders/:id`); vendors can list and view only the order items that are theirs (`GET /api/vendor/orders`, `/api/vendor/orders/:id`) and advance or cancel their own segment's status (`PATCH /api/vendor/orders/:id/status`), with the transition sequentially enforced (no skipping steps, nothing after `DELIVERED` or `CANCELLED`).

**Frontend**
- A `CartProvider` (same shape as `AuthProvider`) holds the cart in memory for the whole session, so the header's cart icon shows a live item-count badge no matter which page you're on, without every page re-fetching it.
- `/products/:id` now has a real quantity stepper and a working "Add to Cart" (a guest sees "Log in to add to cart" instead of a disabled button).
- `/cart`: items grouped by vendor, a quantity stepper per item, remove, and a running subtotal; a "Proceed to checkout" button that's disabled while any item has an `issue`.
- `/checkout`: the same vendor-grouped summary plus the subtotal/shipping/discount/tax/grand-total breakdown, a "Payment Method: Cash on Delivery" placeholder (Day 4 replaces this with a real gateway), and a "Place order" button that calls checkout and lands on the new order's detail page.
- `/orders` and `/orders/:id`: order history and a full breakdown of one order, including each item's own status badge (so a mixed-progress multi-vendor order is visible to the customer, not just "Pending" or "Done").
- The customer dashboard's "Recent orders" panel and the vendor dashboard's new "Orders" panel both now show real data -- the vendor's panel lets them advance or cancel their own segment directly from the dashboard, same place they manage products.

### Key decisions and why

**Checkout re-validates inside the transaction, not before it.**
It would be simpler to check the cart, then separately create the order. But between those two steps another customer could buy the last unit of something in your cart, and you'd check out successfully for a product you can no longer have. Instead, `createOrderFromCart` opens a MongoDB session, and every check (exists, active, vendor approved, enough stock) happens on data read *inside* that same transaction, immediately before the order is written. If anything's wrong, the transaction aborts and nothing is created -- there's no window where a stale check can approve a purchase that's no longer valid.

**A vendor can see an order exists without seeing what's in it for other vendors.**
`GET /api/vendor/orders` doesn't query `Order` and filter client-side -- it queries `OrderItem` for `{ vendor: req.vendor._id }` directly, the same ownership-by-query pattern Day 2 used for products. A multi-vendor order is never assembled in memory with all its items and then trimmed down; the query simply never touches another vendor's rows. Tested directly: Vendor A's dashboard shows their product and a `vendorSubtotal` of just their line, and the same order on Vendor B's dashboard shows only theirs, with neither total matching the customer-facing order total.

**The order's overall status is derived, not stored independently.**
Instead of a customer-facing `Order.status` that a vendor sets directly, each `OrderItem` has its own status, and `Order.status` is recomputed from them: it's whichever status is *least* advanced among the non-cancelled items. A two-vendor order isn't "Shipped" until both vendors have shipped their part. This was a deliberate choice over the simpler "last update wins" approach, because that would let whichever vendor acts last silently overwrite the honest state of an order that isn't actually fully shipped yet.

**A vendor's status change can only move one step forward, or cancel.**
`isValidTransition` only allows `PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED` one step at a time, plus `CANCELLED` from any non-terminal state. A first version allowed suspending a vendor to also demote their role, independent of this -- testing caught that a *suspended* vendor would lose the `VENDOR` role needed to even load `/vendor/orders`, making their in-flight orders permanently stuck with no one able to act on them. That's accepted here as a known limitation (same shape as Day 2's: `loadVendor` already blocks a non-`APPROVED` vendor from managing anything, orders included) rather than fixed, since re-approving restores full access to exactly where things were left off.

**Cart issues are surfaced, never silently resolved.**
If a product in your cart gets suspended or its stock drops, `GET /cart` keeps showing the item with its last known quantity and price, plus an `issue` string explaining what's wrong -- it does not auto-remove the item or clamp the quantity down for you. The "Proceed to checkout" button is disabled while any `issue` exists, so you always know what changed before you're asked to act on it, and checkout's own re-validation is the actual enforcement either way.

**`localStorage`-based auth meant cart state needed its own provider, not a prop.**
The cart icon badge lives in the header, which sits above every page including ones that never otherwise touch cart data (like `/admin`). Threading cart state down as props through `MarketplaceLayout` wouldn't reach it. `CartProvider` mirrors `AuthProvider`'s pattern exactly -- an effect that fetches once per token change, reacting only inside `.then()`, never calling `setState` synchronously in the effect body -- so the two providers behave identically and either can be reasoned about using the same mental model.

### Testing done

- **API:** the full cart lifecycle (add, merge, exceed-stock rejection, update, remove, ownership -- another user's cart item is a 404), checkout success (order created, stock decremented via the same transaction, cart cleared) and checkout failure (cart emptied mid-flight by suspending a vendor: confirmed the stock was *not* touched, no order was created, and the cart still had its item afterward). The multi-vendor isolation was checked directly: Vendor A and Vendor B each queried the same order and only ever saw their own product. Status transitions were tested for every case the rule covers: skipping a step (400), sequential moves (200), and anything after `DELIVERED` or `CANCELLED` (400). A security pass also checked that sending objects (`{"$gt": 0}`-shaped payloads) as `productId` or `quantity` is rejected by validation before it ever reaches a database query.
- **Browser:** 26 automated end-to-end checks in Microsoft Edge covering a guest being redirected away from `/cart`, `/checkout` and `/orders`; adding products from two different vendors and watching the header badge update; the cart page's vendor grouping and quantity updates recalculating the subtotal; checkout showing both vendors and the Cash on Delivery placeholder; landing on the new order after placing it with the cart badge cleared; the order showing up in both the orders list and the customer dashboard; and each vendor's dashboard showing only their own line from the same multi-vendor order, with one vendor successfully advancing their segment's status. The full Day 1 (26 checks) and Day 2 (30 checks) suites were re-run afterward with no regressions.
- `npm run lint` and `npm run build` pass for the frontend.

### Known limitations

- A suspended vendor cannot act on orders they already have in progress (see "Key decisions" -- same shape as Day 2's product-management gate, not fixed for the same reason).
- `POST /api/checkout` requires MongoDB to be running as a replica set (what MongoDB Atlas always provides, including the free tier) -- transactions aren't available against a plain standalone `mongod`.
- Once rejected or cancelled, there's no appeal or reorder flow yet; a cancelled item's status is final from the app's point of view.
- Shipping, discount and tax are always `0` -- the fields and the UI breakdown exist, but the actual calculation logic is Day 4 scope.

---

## Day 4: Payments, order management and vendor commissions

### What was built

**Backend**
- `Payment` (one row per attempt, never a card number or CVV), `Commission` (one row per order item) and `MockTransaction` (the mock provider's own records) models. `Order` gained a `paymentStatus`.
- A provider interface in `services/payment/` with four functions: `createIntent`, `retrieve`, `refund`, `verifyWebhook`. The mock provider implements it with HMAC-SHA256 signed webhooks. Swapping in Stripe means writing one more file and changing `PAYMENT_PROVIDER`; nothing else changes. Credentials only come from environment variables.
- `POST /api/payments/create`: the order must be yours (404 otherwise), not cancelled, and not already paid. The amount comes from the order in the database. Calling it again returns the same open payment, and a partial unique index (one open payment per order) backs that up when two requests race.
- `POST /api/payments/verify` and `POST /api/payments/webhook` both end in one function, `settlePayment`, which runs in a single MongoDB transaction: payment `PAID`, order `CONFIRMED`, its items `CONFIRMED` and the commission rows created. A failed payment leaves the order `PENDING` so the customer can retry.
- Commission = gross x `COMMISSION_RATE`, vendor amount = gross - commission, per order item, with the rate saved on every row. `GET /api/vendor/earnings` returns the summary plus date-filtered history, scoped to the caller's own store.
- Admin: payments list and detail (search by transaction id, status and date filters), orders list, detail and status (search by customer, full id or the short `#id`), `POST /api/admin/payments/:id/refund`, and `GET /api/admin/stats`.
- Cancelling an order now returns its stock. Unpaid orders older than 24 hours are cancelled lazily (see "Key decisions").

**Frontend**
- Checkout no longer says Cash on Delivery: placing an order opens `/pay/:orderId`, which shows the order summary, the amount payable, the method and the payment state (unpaid, pending, processing, successful, failed, expired or cancelled, refunded). The mock provider appears as a clearly labelled "Test mode" panel.
- Order pages show a Paid/Unpaid badge and a "Pay now" link for unpaid orders.
- Vendor dashboard: an Earnings panel (total sales, gross revenue, platform commission, net, pending, paid) with a filterable, paginated table.
- Admin dashboard: marketplace stat cards, quick links, an Orders panel and a Payments panel with details and a refund dialog.

### Key decisions and why

**The payment page never believes the browser.**
Success is shown only after the backend has said so. After a payment the page calls `/payments/verify` and then re-reads the order; `?status=success` in the URL does nothing (tested). The server follows the same rule: verify asks the provider for the real status and checks the amount and order against the database, and the webhook checks its data against the payment it names.

**Verify and the webhook are two doors into one room.**
A webhook can arrive late, twice or never, and the customer's browser can close mid-payment. So either path may settle a payment, and both call `settlePayment`. It claims the payment with `findOneAndUpdate({ status: open })` inside a transaction, so when verify and the webhook race, exactly one wins and the other finds nothing left to do. The webhook also records each event id on the payment, so replaying an event changes nothing.

**Webhook signatures are checked over the raw body.**
`express.raw` is mounted on the webhook path before `express.json`, because re-serialising parsed JSON would not reproduce the signed bytes. The comparison uses `timingSafeEqual`. An unknown or mismatching event is logged and answered with 200, so the provider stops retrying, but it changes nothing.

**A paid order is cancelled by refunding it.**
Admins can cancel unpaid orders directly (the stock goes back). A paid order must be refunded: the provider is asked first, then one transaction marks the payment `REFUNDED`, cancels the items that haven't been delivered (returning their stock) and marks the commissions `REFUNDED`. Refunds are full only, and refunding twice is a 409.

**Commission status follows delivery.**
There is no payout system, so "paid" and "pending" are defined by the order: a commission is `PENDING` once the customer has paid, and `PAID` when that item is `DELIVERED`. Cancelled and refunded rows stay in the history but are left out of every total.

**Vendors cannot move an order nobody has paid for.**
Day 3 let a vendor mark any order `CONFIRMED`. Now the vendor and admin status endpoints share one function that refuses to advance an unpaid order. This also fixed a Day 3 gap: cancelling an order never returned its stock.

**Abandoned orders are cleaned up lazily.**
Stock is reserved at checkout, so an order that is never paid would hold it forever, and Vercel serverless has no background worker. Instead, whenever someone checks out or an admin opens the order list or stats, unpaid orders older than 24 hours are cancelled and their stock is released. Orders from before payments existed have no `paymentStatus` and are never touched.

**Late money is recorded, not lost.**
If a payment arrives for an order that was already cancelled, the payment is still marked `PAID` (the order stays cancelled and no commission is created), so an admin can refund it.

### Testing done

- **Backend (local):** 247 automated checks, all passing. They cover Day 1-3 behaviour (auth and RBAC, vendors, categories, products, cart, checkout, orders), the whole payment lifecycle, webhook hardening (missing, wrong, wrong-length and tampered signatures, replays, late events), 6 parallel creates and 3 parallel refunds, commission amounts to the cent, vendor isolation, the 401/403/400/404 paths of every admin endpoint, regex-escaped and duplicate query params, and a scan that no response contains a secret.
- **Browser:** 48 checks in Microsoft Edge: checkout to payment, a declined payment and retry, success only after verification, a fake success URL, another customer, cancelled and expired orders, a 375px mobile layout, the vendor earnings numbers and tabs, the admin stats, filters, details and refund, and no console errors.
- **Postman:** the collection (new folders for payments, vendor earnings and the admin endpoints) was run with Newman against the real backend: 34 requests, 23 assertions, all passing.
- Frontend `npm run lint` and `npm run build` pass, and a no-undef lint pass over the backend is clean.
- Bugs found and fixed along the way: a 500 on an empty or non-JSON webhook body, a signed event with an object `transactionId` that matched an arbitrary payment (still stopped by later checks, now guarded), and a missing import that broke the new `/payments/order/:orderId` route.

### Known limitations

- **The mock provider is for development only.** With `PAYMENT_PROVIDER=mock`, any logged-in user can mark their own payment as paid, so a real deployment must switch to a real provider (a Stripe test-mode provider is the planned next step).
- Refunds are full only. If the provider refunds but the database update then fails, it is logged for manual reconciliation but not retried automatically.
- Webhook signatures carry no timestamp, so there is no replay window. Idempotency still makes a replay harmless.
- A vendor can cancel an item of an already paid order. That voids their commission, but the money stays with the platform until an admin refunds the payment.
- The cleanup of unpaid orders only runs when someone triggers it. In production this would be a scheduled job (for example a Vercel Cron Job).
- Orders from before Day 4 (Cash on Delivery) show as "Unpaid", and because vendors can no longer advance unpaid orders, they cannot be progressed.
- No rate limiting on login or payment endpoints.
