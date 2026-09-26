# Stockyard — Traceable, Costed & Predictive Inventory System

![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933) ![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-61DAFB) ![Third party APIs](https://img.shields.io/badge/Third--party%20APIs-Zero-critical)

> Built for [Hackathon Name] · Team: _add names here_

**The pitch:** most inventory tools just digitize a register — they tell you
*how much* stock you have. Stockyard also tells you **what it's worth**,
**which batch expires first**, and **what to reorder before you run out** —
all computed locally, with zero third-party services.

---

## 🎯 What We're Building

Strip it down to plain terms: a warehouse receives goods, ships goods, moves
goods between shelves, and occasionally has to correct a miscount. The base
hackathon brief asks for exactly that, wrapped in a dashboard — and every
other team in the room is building precisely that.

Stockyard does all of that, plus the three things that actually separate a
real operations tool from a digitized register: it tracks **which batch** of
stock is which so nothing quietly expires on a back shelf, it knows **what
that stock is worth in dollars** at every moment rather than just a
headcount, and it tells you **what to reorder and when**, based on how fast
you're actually burning through stock — not a number someone typed in once
and forgot about.

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

## 🎬 Demo Walk-Through

This is the exact sequence we run live for judges. Each step demonstrates
one differentiator back to back, using the same "Steel Rods" example from
the brief so the contrast with a plain digitized register is obvious.

| Step | Action | What the judges see |
|---|---|---|
| 1 | Receive 100 units of "Steel Rods" as **Lot A**, expiry in 30 days | A cost layer is created; average cost is set to $10 |
| 2 | Receive 50 more as **Lot B**, expiry in 60 days, at $13/unit | Average cost recalculates live, on screen, to $11 |
| 3 | Create a delivery for 120 units | FEFO automatically pulls all of Lot A + 20 from Lot B — no manual batch picking; inventory value updates correctly |
| 4 | Open the Reorder panel | "Steel Rods" is already flagged, because days-of-stock-left has dropped below its lead time |
| 5 | Run a stock adjustment for 3 damaged units, with a reason | The ledger and audit log both update instantly — nothing is silently overwritten |

> 🗣️ **Line to say out loud at step 3:** *"Notice the delivery just split
> across two batches automatically — that's the part a spreadsheet can't do."*

*(Swap this table for real screenshots or a short GIF of each step once the
frontend is built — visuals land better than a table for a live judged demo.)*

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

*NOTE This is a demo Readme File of What I'm Building not Final.*
