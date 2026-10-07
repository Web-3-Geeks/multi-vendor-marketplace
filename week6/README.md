# Week 6 snapshots

Each `DayN` folder is a complete, standalone copy of the project as it was at the end of that day. Each day includes all the work from earlier days. The live, current project is always at the repository root.

| Folder | Contents |
|---|---|
| `Day1/` | Project setup, JWT authentication, role-based access control (Customer, Vendor, Admin), login and register pages, role dashboards, route guards. Deployed on Vercel. |
| `Day2/` | Vendor applications and admin approval, categories, products (ownership-scoped CRUD, auto-publishing rules), the public marketplace (search/filter/sort/pagination), product detail and vendor store pages, and vendor/admin management UI. Builds on Day 1. |
| `archive/` | Reserved for old or replaced files. Empty for now. |

To run a snapshot, follow the "Running locally" steps in that folder's `README.md`, inside that folder. Each snapshot needs its own `npm install` and `.env` files, because `node_modules` and `.env` are never copied.
