# Week 8 snapshot

`Capstone/` is a complete, standalone copy of the project at the end of Week 8 (Production hardening and deployment). It includes all the Week 6 work. The live, current project is always at the repository root.

| Folder | Contents |
|---|---|
| `Capstone/` | The Week 6 marketplace made production-ready: Dockerfiles for the API (Node 20 alpine, non-root, healthcheck) and the web app (Vite build served by nginx), `docker-compose.yml` (MongoDB replica set + API + web in one command), health check tests for a database outage and the live `version`, a GitHub Actions pipeline (backend tests, frontend lint/tests/build, Docker build, then deploy to Render + Vercel through secret deploy hooks only when everything passes, waiting until the new commit is live), the backend moved to Render (Docker, Singapore), branch protection on `main`, UptimeRobot monitoring, a full-path request log, and the README sections on deployment, CI/CD, monitoring and logs. |

To run it: `docker compose up -d --build` inside `Capstone/` (see "Running with Docker" in its `README.md`), or follow "Running locally". `node_modules` and `.env` files are never copied, so a local run needs `npm install` and its own `.env` files.

The workflow in `Capstone/.github/` is part of the copy only: GitHub Actions runs the one at the repository root.
