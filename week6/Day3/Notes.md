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
- [ ] Deploy + test live (pending push)
- [x] Update Postman collection with cart/checkout/order endpoints
- [x] Update README with Day 3 summary
- [x] Sync root -> week6/Day3 snapshot, commit, push
