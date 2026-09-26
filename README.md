# Stockyard ERP — Warehouse & Inventory Management System

Stockyard is a specialized inventory management system built for high-precision warehouse operations. It is designed around an immutable ledger architecture that provides complete traceability, inventory valuation, and waste minimization.

---

## 1. Project Overview

Stockyard addresses three critical challenges in modern supply-chain logistics:

1. **Batch/Lot Tracking with Expiry Dates & FEFO:** Eliminates product spoilage and expiration by enforcing strict First-Expiry-First-Out dispatch sequencing.
2. **Perpetual Inventory Valuation:** Maintains accurate valuation using weighted-average costing generated continuously through transactional cost layers.
3. **Consumption-Based Reorders:** Replaces static minimum guesswork with automated replenishment triggers calculated from actual historical material movement.

---

## 2. Architecture

Stockyard follows a clean, decoupled architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                 React + Tailwind CSS Client                 │
│      (ERP Shell, High-Density Data Tables, API Client)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Node.js / Express                       │
│    (Centralized Routing, Error Middleware, Health Check)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Raw SQL / pg pool
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│   ├── stock_moves         (Immutable Single Source of Truth)│
│   ├── stock_quants        (Cached Location/Lot On-Hand)     │
│   ├── cost_layers         (Weighted-Average Valuation)      │
│   ├── lots                (FEFO & Expiry Dates)             │
│   └── audit_log           (Full System Traceability)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

- **Backend:** Node.js (v24+) + Express (v4)
- **Database:** Local PostgreSQL (v14+; running on PostgreSQL 18)
- **Database Client:** `pg` (node-postgres) with raw parameterized SQL and connection pooling (no ORMs, no auto-sync)
- **Authentication:** bcrypt + JSON Web Tokens (JWT)
- **Frontend:** React 18 + Vite 6 + Tailwind CSS v3 + React Router v6 + Lucide React
- **Process Orchestration:** npm scripts + Concurrently

---

## 4. Folder Structure

```text
odooXLPU/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial_schema.sql  # 18-table relational schema
│   │   │   └── pool.js                     # pg connection pool & health checker
│   │   ├── routes/
│   │   │   ├── health.js                   # /api/health endpoint
│   │   │   └── index.js                    # Express router index
│   │   ├── services/                       # Business logic services (upcoming)
│   │   ├── middleware/
│   │   │   └── errorHandler.js             # Centralized error & 404 handler
│   │   ├── utils/                          # Common helper functions
│   │   └── server.js                       # Express app entry point
│   ├── scripts/
│   │   └── migrate.js                      # Transactional SQL migration runner
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/                          # Operations & module view shells
│   │   ├── components/
│   │   │   ├── layout/                     # AppShell, Sidebar, Header
│   │   │   └── common/                     # Reusable UI components
│   │   ├── api/
│   │   │   └── client.js                   # Centralized API fetch wrapper
│   │   ├── hooks/                          # Custom React hooks
│   │   ├── utils/                          # Client-side utility functions
│   │   ├── App.jsx                         # React Router layout & routes
│   │   ├── main.jsx                        # React root entry point
│   │   └── index.css                       # Tailwind directives & theme
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── .gitignore
├── .env.example
├── package.json                            # Root workspace script runner
└── README.md
```

---

## 5. PostgreSQL Setup

Stockyard relies on a standard local PostgreSQL instance.

1. Ensure the PostgreSQL service is running on your machine:
   - On Windows: Run `Get-Service -Name *postgres*` in PowerShell.
   - On Linux/macOS: Run `sudo systemctl status postgresql` or `brew services list`.
2. Create the application database using `psql` or pgAdmin:
   ```sql
   CREATE DATABASE stockyard;
   ```
3. Create a dedicated database user (optional, or use default `postgres`):
   ```sql
   CREATE USER stockyard WITH ENCRYPTED PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE stockyard TO stockyard;
   ```

---

## 6. Environment Variables

Copy `.env.example` in `backend/` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Configure your credentials inside `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/stockyard
JWT_SECRET=replace_with_secure_secret
NODE_ENV=development
```

*(Note: Never commit `.env` containing sensitive production credentials.)*

---

## 7. Migration Instructions

Stockyard uses real SQL migration files executed in sorted order within transactions. Migrations are tracked in the `schema_migrations` table.

To run pending migrations:

```bash
# From project root:
npm run db:migrate

# Or directly from backend/:
cd backend
npm run db:migrate
```

The initial migration `001_initial_schema.sql` creates all 18 foundational tables:
- `users`, `password_resets`
- `categories`, `uom`, `warehouses`, `locations`
- `products`, `lots`
- `stock_moves`, `stock_quants`, `cost_layers`
- `receipts`, `receipt_lines`
- `deliveries`, `delivery_lines`
- `adjustments`, `reorder_suggestions`, `audit_log`

---

## 8. Development Commands

### Install All Dependencies
From the repository root:
```bash
npm run install:all
```

### Start Full Development Environment (Backend + Frontend)
Runs the Express API on `http://localhost:5000` and Vite dev server on `http://localhost:3000` concurrently:
```bash
npm run dev
```

### Run Individually
- **Backend Only:**
  ```bash
  npm run dev:backend
  ```
- **Frontend Only:**
  ```bash
  npm run dev:frontend
  ```

### Build Frontend for Production
```bash
npm run build:frontend
```

### Health Check Endpoint
Once the backend is running, verify the health status:
```bash
curl http://localhost:5000/api/health
```
Response:
```json
{
  "status": "ok",
  "service": "stockyard-api",
  "database": "connected",
  "timestamp": "2026-09-26T06:28:24.088Z",
  "uptime": 12.34
}
```

---

## 9. Inventory Architecture Principle

### **`stock_moves` is the immutable single source of truth for inventory changes.**

Application code must **never** directly mutate physical inventory counts without creating and confirming a corresponding `stock_moves` record.

- **`stock_moves` (Immutable Ledger):** Records every physical movement: source location, destination location, product, lot, quantity, unit cost, timestamp, and authorizing document/user. Completed moves are immutable.
- **`stock_quants` (Cached Current State):** Materialized view of on-hand inventory per product, warehouse location, and lot. Updated atomically when a stock move transitions to `done`.
- **`cost_layers` (Inventory Valuation):** Perpetual inventory valuation records established upon inbound receipt confirmation and depleted upon outbound delivery to compute weighted-average cost.
- **`lots` (Traceability & Expiry):** Associates specific manufacturing/vendor batches with strict expiry dates used by FEFO dispatch algorithms.

---

## 10. Authentication, RBAC & Master Data (Phase 2 Implemented)

### Authentication Endpoints
- `POST /api/auth/signup` — Registers new user (`name`, `email`, `password`, `role`). Returns JWT + user identity.
- `POST /api/auth/login` — Authenticates email & password using bcrypt. Returns JWT.
- `POST /api/auth/request-otp` — Generates 6-digit OTP stored in `password_resets` with 15-minute expiry.
  * *Demo Mode Notice:* Returns `demo_otp` on-screen without requiring external email/SMS providers.
- `POST /api/auth/reset-password` — Validates OTP, single-use check, and updates password hash.
- `GET /api/auth/me` — Returns active user profile from Bearer token.

### Role-Based Access Control (RBAC) Permission Model
Stockyard enforces a clear, pragmatic two-role model:

| Role | Master Data Management | Inventory & Ledger Views | Operational Document Creation | System Configuration |
| :--- | :---: | :---: | :---: | :---: |
| **`inventory_manager`** (or `admin`) | **Full (Create/Edit)** | **Full Access** | **Full (Receipts/Deliveries/Adjustments)** | **Full Access** |
| **`warehouse_staff`** | Read-Only | Read-Only | Operational Execution Only | Restricted |

All master data mutation endpoints (`POST /api/categories`, `POST /api/uom`, `POST /api/warehouses`, `POST /api/locations`, `POST /api/products`) enforce `requireManager`. Attempted mutation by `warehouse_staff` yields `403 FORBIDDEN`.

### Master Data APIs
All endpoints require Bearer JWT authentication:
- `GET /api/categories` & `POST /api/categories` (name required, duplicate rejection, hierarchy support)
- `GET /api/uom` & `POST /api/uom` (name required, `conversion_to_base > 0`)
- `GET /api/warehouses` & `POST /api/warehouses` (name required, auto-generated code, unique code)
- `GET /api/locations` & `POST /api/locations` (`warehouse_id` required, name required, `parent_location_id` hierarchy)
- `GET /api/products` & `POST /api/products` (name required, unique SKU, valid `category_id` and `uom_id` foreign keys, `reorder_point >= 0`, `lead_time_days >= 0`)

---

## 11. Upcoming Implementation Phases

- **Phase 3 — Core Stock Engine:** Receipt → Lot → Cost Layer → Stock Move → Stock Quant, followed by FEFO delivery, transfers and adjustments.
- **Phase 4 — FEFO & Batch Engine:** Expiration alerts, batch allocation algorithms, and First-Expiry-First-Out reservation.
- **Phase 5 — Inbound Receipts & Outbound Deliveries:** Goods receipt processing with cost layer generation; customer order fulfillment with automated FEFO picking.
- **Phase 6 — Adjustments & Physical Inventory Reconciliation:** Cycle counts, variance calculations, and balanced inventory loss/gain stock moves.
- **Phase 7 — Consumption-Based Reorders:** Automated replenishment calculation engine based on historical move consumption and min/max levels.

