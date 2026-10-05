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
