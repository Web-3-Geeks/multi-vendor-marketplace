# End-to-end tests (Playwright)

Browser tests that drive the real UI against a running backend + frontend. They cover:

- **customer-checkout** – cart → checkout address validation → payment (declined, retry, success) → order detail, forged-URL and cross-customer checks, cancelled orders.
- **vendor-admin** – vendor fulfilment and archive prompts; admin vendor suspend/approve, product take-down/restore, order cancel, activity timeline and log.
- **access-and-layout** – route guards for every role, and no horizontal scroll at tablet (768px) and phone (375px) widths.

Test data is created through the public API (new customers, two approved stores, a category, two products), so the suite needs **no database access** — only a seeded admin account. Everything it creates is tagged `e2e-…` / `E2E …`; run it against a **dev or test database**, not production.

## Run

```bash
# 1. start the backend and the frontend (two terminals)
cd backend  && npm run dev
cd frontend && npm run dev

# 2. install and run the suite
cd e2e
npm install
E2E_ADMIN_PASSWORD=<SEED_ADMIN_PASSWORD from backend/.env> npm run e2e
npm run e2e -- checkout        # only specs whose filename contains "checkout"
```

PowerShell: `$env:E2E_ADMIN_PASSWORD="..."; npm run e2e`

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `E2E_ADMIN_PASSWORD` | – (required) | Password of the seeded admin |
| `E2E_ADMIN_EMAIL` | `admin@test.com` | Seeded admin email |
| `E2E_API_URL` | `http://localhost:5000/api` | Backend base URL (incl. `/api`) |
| `E2E_WEB_URL` | `http://localhost:5173` | Frontend URL |
| `E2E_BROWSER_CHANNEL` | `msedge` | Installed browser to use (`msedge`, `chrome`) |
| `E2E_BROWSER_PATH` | – | Path to a browser executable (overrides the channel) |
| `E2E_HEADED` | `false` | `true` shows the browser window |

## Notes

- The backend's rate limits apply. If you run the suite many times in a row against one server, start the backend with `RATE_LIMIT_DISABLED=true` (never in production) — registering is limited to 20 per hour per IP.
- The process exits with code `1` if any check fails or the browser logs a console error, so it can run in CI.
- Uses `playwright-core` (no browser download): it drives a browser already installed on the machine.
