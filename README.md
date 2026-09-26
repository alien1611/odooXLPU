# Stockyard — Traceable, Costed & Predictive Inventory System

> Built for [Hackathon Name] · Team: _add names here_

**The pitch:** most inventory tools just digitize a register — they tell you
*how much* stock you have. Stockyard also tells you **what it's worth**,
**which batch expires first**, and **what to reorder before you run out** —
all computed locally, with zero third-party services.

---

## Problem Statement

Many businesses still track stock with spreadsheets and paper logs, leading
to stockouts, expired/wasted goods, and no real visibility into inventory
value. The base brief asks for a modular Inventory Management System (IMS)
covering Products, Receipts, Delivery Orders, Internal Transfers, and Stock
Adjustments with a live dashboard.

## What Makes This Different

The base spec stops at quantity tracking. We extended it with three
real-world capabilities most teams will skip:

| # | Feature | Why it matters |
|---|---------|-----------------|
| 1 | **Batch/Lot tracking + FEFO picking** | Perishable/dated goods must be picked oldest-expiry-first, not arbitrarily |
| 2 | **Weighted-average inventory valuation** | Knowing *quantity* isn't enough — a real business needs to know what stock is *worth* |
| 3 | **Consumption-based reorder suggestions** | A static "low stock" threshold is guesswork; we predict from actual usage history |

## Target Users

- **Inventory Manager** — manages incoming/outgoing stock, approves receipts and deliveries
- **Warehouse Staff** — performs transfers, picking, shelving, and stock counts

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL (local instance, raw SQL migrations — no ORM auto-sync magic)
- **Frontend:** React + Tailwind CSS
- **Auth:** bcrypt (password hashing) + JWT (sessions), self-implemented RBAC middleware
- **Zero third-party services** — no Firebase/Auth0/Twilio/cloud DB/hosted AI APIs. OTP-based
  password reset is shown on-screen in a clearly labeled demo-mode banner instead of emailing it,
  since sending real email/SMS would require an external provider.

## Core Features

### Baseline
- Authentication with RBAC (email/password, OTP-based reset)
- Dashboard: live KPIs (Total Products, Low/Out of Stock, Pending Receipts/Deliveries, Transfers Scheduled) with filters by document type, status, warehouse, category
- Product, Category, UoM, Warehouse, and Location management
- Receipts (incoming stock) with supplier + line items
- Delivery Orders (outgoing stock): pick → pack → validate
- Internal Transfers between locations/warehouses
- Stock Adjustments (recorded qty vs. physical count, with reason)
- Move History — a full stock ledger, not just current totals

### Differentiators
- **Lot/batch tracking** with manufacture and expiry dates per receipt
- **FEFO picking** on delivery — automatically consumes the soonest-to-expire
  stock first, splitting a single delivery across multiple lots when needed
- **Weighted-average costing** — recalculated on every receipt, so inventory
  value is always current
- **Reorder suggestions** computed from actual 30-day consumption rate vs.
  each product's lead time — not a fixed "reorder point" guess
- **Expiry alerts** — lots expiring within 7 days surfaced on the dashboard

## Database Design

The core design decision: **`stock_moves` is an append-only ledger and the
single source of truth for every quantity change in the system.** No other
table's quantity is ever written directly by application code — receipts,
deliveries, transfers, and adjustments all resolve to rows in this table,
and `stock_quants` is a derived cache kept in sync from it. This gives us a
full audit trail, accurate Move History, and correct FIFO/weighted-average
costing "for free."

**Entity relationships (high level):**
```
products    -> categories, uom
products    -<  lots  -<  stock_moves
lots        -<  cost_layers                (drives costing)
warehouses  -<  locations  -<  stock_moves (from / to)
receipts    -<  receipt_lines  -> products
deliveries  -<  delivery_lines -> products
adjustments -> products
stock_moves -> users (created_by)
```

Full column-level schema lives in [`backend/src/db/migrations/001_init.sql`](backend/src/db/migrations/001_init.sql).

**Key algorithms** (implemented in `backend/src/services/`):

```
# Weighted average costing (recomputed on every receipt)
new_avg_cost = ((current_qty * current_avg_cost) + (received_qty * received_unit_cost))
               / (current_qty + received_qty)

# FEFO picking (delivery may span multiple lots)
SELECT lot_id, quantity, expiry_date FROM stock_quants JOIN lots ...
ORDER BY expiry_date ASC   -- consume oldest-expiry stock first, split if needed

# Reorder suggestion
avg_daily_consumption = SUM(delivered_qty, last 30 days) / 30
days_of_stock_left    = current_qty / avg_daily_consumption
flag if days_of_stock_left < lead_time_days
```

## Getting Started

```bash
# 1. Clone and install
git clone <this-repo>
cd stockyard

# 2. Database
createdb stockyard
psql -d stockyard -f backend/src/db/migrations/001_init.sql

# 3. Backend
cd backend
cp .env.example .env      # set DATABASE_URL, JWT_SECRET, PORT
npm install
npm run seed               # loads demo products, lots, and 30 days of move history
npm run dev

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Default demo login is created by the seed script — see console output after `npm run seed`.

## API Overview

```
POST   /api/auth/signup            POST /api/auth/login
POST   /api/auth/request-otp       POST /api/auth/reset-password

GET/POST  /api/products  /api/categories  /api/uom  /api/warehouses  /api/locations

GET/POST  /api/receipts            POST /api/receipts/:id/validate
GET/POST  /api/deliveries          POST /api/deliveries/:id/validate
POST      /api/transfers
POST      /api/adjustments

GET  /api/stock-moves                        # full ledger, filterable
GET  /api/dashboard/kpis
GET  /api/reports/reorder-suggestions
GET  /api/reports/inventory-value
GET  /api/reports/expiring-lots
```

All routes except `/api/auth/*` require a JWT; mutating routes are further
gated by role via RBAC middleware.

## Demo Script

1. Receive 100 units of "Steel Rods" as **Lot A** (expiry in 30 days) → cost layer created, avg cost set
2. Receive 50 more as **Lot B** (expiry in 60 days) at a different unit cost → avg cost recalculates live
3. Create a delivery for 120 units → FEFO automatically pulls all of Lot A + 20 from Lot B; inventory value updates correctly
4. Open the reorder panel → the product is flagged because days-of-stock-left < lead time
5. Run a stock adjustment for 3 damaged units → logged to the ledger with a reason and an audit trail entry

## Project Structure

```
/backend
  /src
    /db          migrations, connection pool
    /routes      one file per resource
    /services    costing.js, fefo.js, reorder.js
    /middleware  auth.js, rbac.js
  server.js
/frontend
  /src
    /pages
    /components
    /api
```

## Roadmap Status

- [ ] Schema + migrations
- [ ] Auth + RBAC
- [ ] Master data CRUD
- [ ] Core stock engine (receipts, deliveries + FEFO, transfers, adjustments)
- [ ] Reorder suggestions + expiry alerts + valuation report
- [ ] Frontend (dashboard, forms, ledger view)
- [ ] Seed data + demo rehearsal

## Team

| Name | Role |
|------|------|
| _add here_ | |

## License

_Add license if required by the hackathon rules._
