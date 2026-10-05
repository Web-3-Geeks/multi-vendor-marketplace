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
  constants/roles.js     CUSTOMER, VENDOR, ADMIN in one place
  models/User.js         User schema, password hashing, password comparison
  validators/            Request validation rules (register, login)
  middleware/
    validate.js          Returns 400 with per-field errors if validation fails
    auth.js              authenticate (401) and requireRole (403)
    errorHandler.js      Central error handler
  controllers/           Request handlers (register, login, me, logout)
  routes/                Auth routes and role dashboard routes
  scripts/seed.js        Creates the demo vendor and admin accounts

frontend/src/
  lib/api.js             One function for every API call (headers, token, errors)
  context/, hooks/       Auth state: AuthProvider and useAuth()
  components/routing/    ProtectedRoute and GuestRoute
  components/ui/         TextField, Button, Alert, FullPageLoader
  components/dashboard/  Layout, sidebar and dashboard widgets
  pages/                 Login, Register and the three role dashboards
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

Protected requests send `Authorization: Bearer <token>`.

**Status codes used consistently:**

| Code | Meaning |
|---|---|
| 400 | Validation failed. Body has `errors: [{ field, message }]` |
| 401 | Not logged in: token missing, invalid, expired, or user no longer exists |
| 403 | Logged in, but the role is not allowed |
| 404 | Route not found |
| 409 | Email already registered |
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
- The error handler reports every duplicate-key error as "Email already registered". That is correct while email is the only unique field, and needs to change when more unique fields are added.
- Dashboard sections for products, orders and payments are placeholders. They are marked "Soon" and show empty states, not sample numbers.
