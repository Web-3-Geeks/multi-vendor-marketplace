# Week 6 - Day 1 Plan: Setup, Authentication & RBAC

Stack: Node/Express + MongoDB (backend) - React + Tailwind (frontend)

## 1. Project Setup
- [x] Scaffold backend (Express app, folder structure: routes/controllers/models/middleware)
- [x] Scaffold frontend (Vite + React + Tailwind)
- [x] Install backend deps (express, mongoose, bcrypt, jsonwebtoken, cors, dotenv, express-validator)
- [x] .env files (DATABASE_URL, JWT_SECRET, FRONTEND_URL, BACKEND_URL, PORT)
- [x] Connect MongoDB via mongoose
- [x] CORS config
- [x] Centralized error-handling middleware
- [x] Request validation setup (express-validator)
- [x] GET /api/health health-check endpoint

## 2. Database Models
- [x] User model (name, email, password, role enum [CUSTOMER/VENDOR/ADMIN], timestamps, unique+indexed email)
- [x] Password hashing (bcrypt pre-save hook)

## 3. Authentication
- [x] POST /api/auth/register (validate input, prevent duplicate email, force role=CUSTOMER, hash password)
- [x] POST /api/auth/login (verify credentials, issue JWT; role read from DB on each request, not stored in token)
- [x] POST /api/auth/logout
- [x] GET /api/auth/me

## 4. RBAC Middleware
- [x] authenticate middleware (verify JWT, attach user, 401 on failure)
- [x] requireRole(...roles) middleware (403 on mismatch)
- [x] Protected demo routes: /api/customer/dashboard, /api/vendor/dashboard, /api/admin/dashboard
- [x] Seed script for VENDOR/ADMIN test users (npm run seed)

## 5. Frontend Auth
- [x] Register page (UI)
- [x] Login page (UI)
- [x] Auth context/state (store user+token, login/logout actions, persist via localStorage)
- [x] ProtectedRoute component (redirect if not authenticated / wrong role)
- [x] GuestRoute (logged-in users skip login/register)
- [x] Role-based dashboard pages (Customer/Vendor/Admin - show user info)
- [x] Logout wiring (clear state, redirect to login)

## 6. Wrap-up
- [x] Manual test: Register -> Login -> Dashboard -> blocked from other roles' dashboards -> Logout (26 browser checks, local + live)
- [x] Lint + build check (frontend)
- [x] Deploy backend + frontend on Vercel
- [x] Update README with Day 1 summary
- [x] Git init + first commit
- [x] Code review: input type/length validation, keep token on network errors, required env check, no X-Powered-By
- [x] Sync root -> week6/Day1 snapshot, commit, push

# Week 6 - Day 2 Plan: Vendor Management, Products & Marketplace Catalog

## 1. Vendor Model & Application
- [x] Vendor model (userId, storeName, storeDescription, logo, status enum [PENDING/APPROVED/SUSPENDED/REJECTED], timestamps)
- [x] One vendor profile per user, prevent duplicates
- [x] POST /api/vendors (submit application, status=PENDING)

## 2. Admin Vendor Management
- [x] GET /api/admin/vendors (list applications)
- [x] GET /api/admin/vendors/:id (view details)
- [x] PATCH /api/admin/vendors/:id/status (approve/reject/suspend/reactivate)
- [x] Approving a vendor updates the user's role to VENDOR

## 3. Category Model & CRUD
- [x] Category model (name, slug, description, timestamps, unique name+slug)
- [x] POST/PATCH/DELETE /api/categories (admin only)
- [x] GET /api/categories (everyone)
- [x] Block delete if products use the category (or soft delete) (blocked with 409, no soft delete)

## 4. Product Model
- [x] Product model (vendorId, categoryId, name, slug, description, price, stock, images, status enum [DRAFT/ACTIVE/OUT_OF_STOCK/ARCHIVED], timestamps)
- [x] Validation: price > 0, stock >= 0, unique slug
- [x] Indexes: vendor, category, status, slug

## 5. Vendor Product CRUD
- [x] POST /api/vendor/products (approved vendors only)
- [x] GET /api/vendor/products, GET /api/vendor/products/:id
- [x] PATCH /api/vendor/products/:id (ownership check: only own products)
- [x] DELETE /api/vendor/products/:id (ownership check, archives instead of hard delete)
- [x] Publishing rule: ACTIVE only if vendor approved + all fields valid

## 6. Public Marketplace API
- [x] GET /api/products (only ACTIVE, from approved vendors)
- [x] GET /api/products/:id
- [x] Search (?search=), category/vendor filter, price range, sorting (price_asc/price_desc/newest), pagination

## 7. Marketplace Frontend
- [x] /products page (listing + product cards)
- [x] /products/:id page (details, add to cart button - wired on Day 3)
- [x] /vendor/:id page (store page)
- [x] Filters UI (search, category, vendor, price range, sort) - no full page reload (synced to URL query params)

## 8. Vendor Dashboard (extend Day 1)
- [x] Store name, status, total/active/out-of-stock product counts
- [x] Product list, add/edit/archive/delete, stock management
- [x] Pending/suspended vendors see status + restrictions clearly

## 9. Wrap-up
- [x] Manual test: Apply -> Approve -> Create product -> Publish; Browse -> Search -> Filter -> Sort -> Details (30 automated browser checks)
- [x] Lint + build check
- [x] Deploy + test live (pending push)
- [x] Postman collection file with all endpoints
- [x] Update README with Day 2 summary
- [x] Sync root -> week6/Day2 snapshot, commit, push

# Week 6 - Day 3 Plan: Shopping Cart, Multi-Vendor Cart & Order Management

## 1. Cart Model & Add to Cart
- [x] Cart model (userId, timestamps) - one active cart per user
- [x] CartItem model (cartId, productId, quantity, timestamps) - no duplicate product per cart, quantity > 0
- [x] POST /api/cart/items (product must exist, ACTIVE, vendor APPROVED, quantity <= stock; increase qty if already in cart)

## 2. View / Update / Remove Cart Items
- [x] GET /api/cart (product info, image, vendor, unit price, qty, item subtotal, cart subtotal, item count - prices from DB only)
- [x] PATCH /api/cart/items/:id (re-validate product/vendor/stock on every update)
- [x] DELETE /api/cart/items/:id (ownership check, 404 if not found, recompute totals)

## 3. Cart Calculation Service
- [x] Centralized calculator: item subtotal, cart subtotal
- [x] Structure ready for shipping/discount/tax/grand total (Day 4+)
- [x] Multi-vendor grouping in the response

## 4. Checkout Validation
- [x] POST /api/checkout - re-check everything server-side (exists, ACTIVE, vendor APPROVED, stock, DB prices)
- [x] Fail safely as one unit if anything is invalid, no partial order

## 5. Order & OrderItem Models + Creation
- [x] Order model (userId, status enum [PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED], subtotal/shipping/discount/tax/total, timestamps)
- [x] OrderItem model (orderId, productId, vendorId, productName + unitPrice snapshot, quantity, subtotal)
- [x] Create order from validated cart, reduce stock, clear cart - as one atomic operation (Mongo transaction)

## 6. Customer Order APIs
- [x] GET /api/orders (own orders only)
- [x] GET /api/orders/:id (ownership check, 404 not 403 for others' orders)

## 7. Vendor Order Access & Status
- [x] GET /api/vendor/orders (only order items for this vendor's products)
- [x] GET /api/vendor/orders/:id (same scoping)
- [x] PATCH /api/vendor/orders/:id/status (own items only, validate allowed transitions)

## 8. Cart Frontend
- [x] /cart page (image, name, vendor, price, qty controls, subtotal, remove, cart subtotal, checkout button)
- [x] No full page reload on qty change; loading states; stock error messages; empty cart state
- [x] Header cart icon + live item-count badge (CartContext shared across the app)
- [x] Product detail page: quantity selector + working Add to Cart (login-gated for guests)

## 9. Checkout Page
- [x] /checkout (items, vendor info, qty, prices, subtotal/shipping/discount/tax/grand total, placeholder payment = Cash on Delivery)

## 10. Customer Orders UI
- [x] /orders (history list) and /orders/:id (detail: items, vendors, totals, status, date)
- [x] Customer dashboard "Recent orders" wired to real data
- [x] Vendor dashboard order management UI (list own order-item segments, advance/cancel status) -- Task 12/13's UI counterpart

## 11. Wrap-up
- [x] Manual test: Browse -> multi-vendor cart -> checkout -> order -> order history; vendor sees only own order items (26 automated browser checks + full Day 1/Day 2 regression)
- [x] Lint + build check
- [x] Deploy + test live (pending push)
- [x] Update Postman collection with cart/checkout/order endpoints
- [x] Update README with Day 3 summary
- [x] Sync root -> week6/Day3 snapshot, commit, push

# Week 6 - Day 4 Plan: Payments, Order Management & Vendor Commissions

## 1. Payment Model & Provider (backend)
- [x] Payment status constants + Payment model (order, user, amount, currency, provider, transactionId unique-sparse, status, paymentMethod, paidAt, refund info, processedEvents for idempotency)
- [x] Env vars: PAYMENT_PROVIDER, PAYMENT_PUBLIC_KEY, PAYMENT_SECRET_KEY, PAYMENT_WEBHOOK_SECRET (+ .env.example, required-env check)
- [x] Payment provider layer (services/payment/): fixed interface createIntent / retrieve / verifyWebhook / refund, mock provider implementation

## 2. Payment Flow (backend)
- [x] POST /api/payments/create (auth, order ownership by query, eligibility, amount from DB, provider intent, store Payment)
- [x] POST /api/payments/verify (provider lookup, amount + order match, idempotent, Payment PAID + Order CONFIRMED, failure handling)
- [x] POST /api/payments/webhook (raw body, signature check, success/failed events, event-id idempotency)
- [x] Block paying an already-paid order; expire abandoned payment sessions
- [x] Update Day 3 checkout: orders start unpaid/PENDING, payment drives CONFIRMED

## 3. Commissions & Vendor Earnings (backend)
- [x] Commission model (order, orderItem, vendor, grossAmount, commissionRate, commissionAmount, vendorAmount, status)
- [x] Configurable COMMISSION_RATE; create commission records when payment becomes PAID
- [x] GET /api/vendor/earnings (totals, paid/pending, item references, date history, own products only)

## 4. Admin Management (backend)
- [x] GET /api/admin/payments (search by transactionId, status + date filters, customer info)
- [x] GET /api/admin/payments/:id
- [x] GET /api/admin/orders (search, status + payment-status filters)
- [x] GET /api/admin/orders/:id
- [x] PATCH /api/admin/orders/:id/status (allowed transitions, cancel rules)
- [x] POST /api/admin/payments/:id/refund (eligibility, no double refund, provider refund, update payment + order)
- [x] Admin dashboard stats endpoint (orders, payments, sales, commission)

## 5. Backend Review
- [x] Security/correctness pass: no card data, no secrets in responses/logs, server-side amounts, ownership, signature, idempotency, unauthorized refunds

## 6. Frontend
- [x] Payment page (order summary, amount, method, status states: pending/processing/success/failed/cancelled, loading)
- [x] Success only after backend verification (never from redirect)
- [x] Vendor earnings dashboard (cards + earnings table)
- [x] Admin dashboard (stat cards + quick links to Orders/Payments/Vendors/Products/Categories)
- [x] Admin orders + payments pages (list, filters, detail, refund)

## 7. Wrap-up
- [ ] Manual/automated test: order -> pay -> verified -> CONFIRMED; vendor earnings; admin views + refund; full Day 1-3 regression
- [x] Lint + build check
- [x] Postman collection: Day 4 folders (payments, vendor earnings, admin payments/orders/stats)
- [x] README: Day 4 section + endpoint table + structure
- [x] Sync root -> week6/Day4 snapshot + snapshot index row
- [ ] Deploy + test live (pending push)

# Week 6 - Day 5 Plan: Integration, Testing, Security & Deployment Readiness

## 0. Shipping address (added on top of the Day 5 spec)
- [x] Order.shippingAddress (fullName, phone, line1, line2, city, state, postalCode, country); legacy orders without one keep working
- [x] POST /api/checkout requires + validates the address (whitelisted fields only) and snapshots it on the order
- [x] Address returned on customer order DTO and admin order detail; vendor sees it only for PAID orders containing their items
- [x] Checkout page address form (field errors), address shown on payment page, order detail, vendor + admin order views
- [x] Postman checkout request updated with the address body

## 1. Order and payment lifecycle (Task 2)
- [x] One state-machine module (services/stateMachine.js): valid order + payment status transitions, used by every status change
- [x] Audit trail backend (append-only AuditLog; payment events, refunds, order status changes, vendor/product/category admin actions) + GET /api/admin/audit-logs
- [x] Audit trail UI: activity timeline in the admin order details + admin Activity log panel (filters, pagination)
- [x] Admin product moderation backend: GET /api/admin/products, PATCH /api/admin/products/:id/status (takedown lock the vendor can't undo)
- [x] Admin products panel UI (search, status filter, take down / restore, vendor lock badge on the vendor side)

## 2. Security and data integrity (Task 4)
- [x] Rate limiting on auth + payment/checkout/refund/webhook + global, helmet security headers, body sanitiser, 100kb body limit
- [x] Index review (new indexes on products, vendors, commissions, order items, audit log); no secret/stack leaks in errors verified
- [x] Documented security checklist in README

## 3. Performance and UX (Task 5)
- [x] Pagination backend: customer orders, vendor orders, vendor products (+ store-wide summary), admin vendor applications, public vendors
- [x] Pagination UI: customer orders, vendor orders + products (with search), admin vendors (with search), products, activity
- [x] Fix N+1 in the customer order list (3 queries per page instead of 2 per order)
- [x] Vercel function region set to Mumbai (bom1) to match the Atlas cluster (AWS ap-south-1): checkout 3.2s -> 0.3s
- [x] Confirmation prompts (shared ConfirmDialog): archive product, delete category, reject/suspend vendor, admin cancel order, vendor cancel items, take down product (refund already had one)
- [x] Success messages on every admin/vendor action, stale-data dimming while paging, empty states; tablet + mobile checked (no horizontal scroll)
- [x] Fixed: modals were clipped inside backdrop-blur panels (now rendered through a portal)

## 4. Automated tests in the repo (Task 3)
- [x] Backend: Jest + Supertest on a separate test database (auth, RBAC, vendors, products, cart/checkout, orders, payments, commissions, admin, validation)
- [x] Integration workflows (customer -> payment -> vendor -> admin refund; duplicate webhook safety)
- [x] Frontend: Vitest + React Testing Library (auth, cart/checkout, vendor + admin screens, states)
- [x] Playwright E2E scripts kept in e2e/ (desktop, tablet, mobile)

## 5. Deployment readiness and docs (Task 6)
- [x] Database setup script: npm run db:setup (creates collections + indexes; autoIndex is off in production)
- [x] .env.example complete; dev vs production env documented
- [x] Request logging (no query strings or bodies) + /api/health reports database state and uptime
- [x] Confirm production URLs, CORS and webhook URL
- [x] Document enabling a real payment provider (Stripe test mode steps)
- [x] README: overview, setup, tests, API, roles, payment workflow, security checks, deployment, test accounts
- [x] Postman collection: audit logs, admin products, pagination params
- [x] Production build passes; week6/Day5 snapshot + index row
- [x] Final live test on the deployed URLs (e2e 57/57, Newman 34 requests / 23 assertions, headers, validation, injection, CORS, 413)
