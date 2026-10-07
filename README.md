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
  constants/              Roles, vendor statuses, product statuses -- each in one place
  models/
    User.js               Password hashing, password comparison
    Vendor.js              One store per user, status PENDING/APPROVED/SUSPENDED/REJECTED
    Category.js            Unique name + slug
    Product.js              Belongs to a vendor and a category; auto DRAFT<->ACTIVE<->OUT_OF_STOCK
  utils/slugify.js, uniqueSlug.js   URL-friendly slugs; products get a random suffix to avoid clashes
  validators/             Request validation rules, one file per resource
  middleware/
    validate.js            Returns 400 with per-field errors if validation fails
    auth.js                authenticate (401) and requireRole (403)
    loadVendor.js           Loads the caller's store, 403s if it isn't APPROVED
    errorHandler.js         Central error handler (also maps duplicate keys and bad ids to 409/400)
  controllers/, routes/   One pair per resource: auth, vendors, admin vendor management,
                          categories, vendor's own products, the public product catalog
  scripts/seed.js         Creates the demo vendor (with an APPROVED store) and admin

frontend/src/
  lib/api.js, format.js   One function for every API call; price/date/stock formatting
  hooks/useApi.js         Generic GET hook: loading/error/data + a reload() for after a mutation
  context/, hooks/        Auth state: AuthProvider and useAuth()
  components/routing/    ProtectedRoute and GuestRoute
  components/ui/         TextField, Select, TextArea, Button, Modal, Badge, Alert, Spinner...
  components/dashboard/  Layout, sidebar and dashboard widgets
  components/marketplace/ Public header/layout, product card, filters, pagination
  components/vendor/     Become-a-vendor form, product add/edit modal, product table row
  components/admin/      Vendor application review, category CRUD
  pages/                 Login, Register, three role dashboards, and the public marketplace pages
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
| `SEED_ADMIN_PASSWORD` | Password for `admin@test.com`, used only by `npm run seed` |
| `SEED_VENDOR_PASSWORD` | Password for `vendor@test.com`, used only by `npm run seed` |

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

Protected requests send `Authorization: Bearer <token>`.

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
- Dashboard sections for orders and payments are still placeholders, marked "Soon". Products are no longer a placeholder as of Day 2 (see below).

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
- Public marketplace, reachable with or without logging in: `/products` (search, category, price range and sort filters that update the list without a page reload, via URL query params so a filtered view is shareable and survives a refresh), `/products/:id` (gallery, description, stock, a disabled "Add to Cart" wired up on Day 3), and `/vendor/:id` (a store page listing that vendor's products).
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
