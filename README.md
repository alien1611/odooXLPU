# Stockyard ERP — Traceable, Costed & Predictive Inventory System

![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933) ![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-61DAFB) ![Zero Third-party APIs](https://img.shields.io/badge/Third--party%20APIs-Zero-success)

Stockyard is a specialized inventory management system built for high-precision warehouse operations. It is designed around an immutable ledger architecture that provides complete traceability, inventory valuation, and waste minimization.

**The core differentiator:** most inventory tools merely digitize a static register — they track *how much* quantity is recorded. Stockyard tracks **what that stock is worth** (perpetual weighted-average costing), **which batch expires first** (strict FEFO dispatch), and **what to reorder based on actual consumption velocity** — all computed locally with zero third-party dependencies.

---

## 1. What Makes This Different

| # | Core Capability | Business Impact & Rationale |
|---|---|---|
| 1 | **Batch/Lot Tracking + FEFO Picking** | Perishable and dated goods are picked and consumed strictly oldest-expiry-first, splitting shipments across batches automatically when required. |
| 2 | **Weighted-Average Costing Layers** | Perpetual valuation recalculated transactionally upon every receipt: $\text{Avg Cost} = \frac{(\text{Old Qty} \times \text{Old Cost}) + (\text{New Qty} \times \text{New Cost})}{\text{Total Qty}}$. |
| 3 | **Consumption-Based Reorders** | Real usage velocity over moving windows ($d \times L + SS$) replaces static manual threshold guesswork. |
| 4 | **Immutable Stock Ledger** | `stock_moves` is the single source of truth for every inventory quantity change; `stock_quants` is a transactionally maintained state cache. |

---

## 2. Architecture Overview

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
- **Database:** Local PostgreSQL (raw SQL migrations and parameterized queries with `pg` connection pooling; no ORMs)
- **Authentication:** bcrypt password hashing + JWT session tokens + self-implemented RBAC middleware
- **Frontend:** React 18 + Vite 6 + Tailwind CSS v3 + React Router v6 + Lucide React
- **Test Harness:** Automated end-to-end operational verification suites (`test-phase2.js`, `test-phase3.js`) with transactional memory engine (`pg-mem`)
- **Zero Third-Party Cloud Services:** 100% locally self-contained

---

## 4. Folder Structure

```text
odooXLPU/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_initial_schema.sql             # 18-table relational schema
│   │   │   │   ├── 002_phase2_auth_and_master_data.sql # Auth constraints & OTP resets
│   │   │   │   └── 003_phase3_stock_engine.sql        # Transfers table & audit constraints
│   │   │   └── pool.js                                # pg connection pool & health checker
│   │   ├── routes/                                    # Express REST routers
│   │   │   ├── auth.js, health.js, products.js, categories.js, uom.js
│   │   │   ├── warehouses.js, locations.js, receipts.js, deliveries.js
│   │   │   ├── transfers.js, adjustments.js, quants.js, moves.js, lots.js, auditLogs.js
│   │   │   └── index.js
│   │   ├── services/                                  # Business logic & transactional engines
│   │   │   ├── authService.js, productService.js, warehouseService.js
│   │   │   ├── receiptService.js, deliveryService.js, transferService.js
│   │   │   ├── adjustmentService.js, stockQuantService.js, costLayerService.js
│   │   │   ├── stockMoveService.js, auditService.js
│   │   ├── middleware/
│   │   │   ├── auth.js, rbac.js, errorHandler.js
│   │   └── server.js                                  # Express app entry point
│   ├── scripts/
│   │   ├── migrate.js                                 # Transactional SQL migration runner
│   │   ├── test-phase2.js                             # Phase 2 test suite
│   │   └── test-phase3.js                             # Phase 3 core stock engine test suite
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/                                     # Operational ERP views
│   │   │   ├── DashboardPage.jsx, InventoryPage.jsx, StockMovesPage.jsx
│   │   │   ├── ReceiptsPage.jsx, DeliveriesPage.jsx, TransfersPage.jsx
│   │   │   ├── AdjustmentsPage.jsx, LotsPage.jsx, ReordersPage.jsx
│   │   │   └── master/ (ProductsPage, CategoriesPage, UomPage, WarehousesPage, LocationsPage)
│   │   ├── components/
│   │   │   ├── layout/ (AppShell, Sidebar, Header)
│   │   │   └── common/
│   │   ├── api/
│   │   │   └── client.js                              # Centralized API fetch wrapper
│   │   ├── hooks/useAuth.jsx
│   │   ├── App.jsx                                    # Router configuration
│   │   └── index.css                                  # Tailwind directives & theme
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
├── package.json                                       # Root orchestration scripts
└── README.md
```

---

## 5. 🎬 Live Verification & Walk-Through Sequence

This sequence demonstrates the core differentiators back-to-back:

| Step | Action | Engine Behavior & Outcome |
|---|---|---|
| **1** | Receive 100 units of "Steel Rods", Lot A (+30d expiry) @ $10.00 | Cost layer 1 created. Product weighted-average cost is initialized to **$10.00**. Quant: 100 at Stock. |
| **2** | Receive 50 units of "Steel Rods", Lot B (+60d expiry) @ $13.00 | Weighted-average cost recalculated: $\frac{(100 \times 10) + (50 \times 13)}{150} = \mathbf{\$11.00}$. Cost layer 2 created. Total Quant: 150. |
| **3** | Dispatch 120 units on outbound delivery | Strict **FEFO** pulls 100 from Lot A (depleted to 0) + 20 from Lot B (30 remaining). Cost layer 1 depleted to 0; layer 2 remaining: 30. Total stock: 30. |
| **4** | Attempt dispatch of 50 units | Rejected with `400 INSUFFICIENT_STOCK` (only 30 available). Transaction is rolled back with zero state persisted. |
| **5** | Transfer 10 units of Lot B to Shelf B | Location Stock decreases from 30 to 20; Shelf B increases from 0 to 10. **Lot ID and cost price preserved.** Total stock remains 30. |
| **6** | Stock adjustment for 2 damaged units | Physical count of 18 recorded (difference: -2). Quant updated to 18; compensatory move logged to inventory loss location. |

---

## 6. Getting Started

### Prerequisites

- Node.js v20+ (Node v24 tested)
- PostgreSQL (local instance or test suite)
- npm v10+

### Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/alien1611/odooXLPU.git
cd odooXLPU

# 2. Install all dependencies
npm run install:all

# 3. Environment configuration
cp backend/.env.example backend/.env
# Edit backend/.env if needed (PORT=5000, DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stockyard)

# 4. Database Migrations
npm run db:migrate

# 5. Run automated test suites
npm test

# 6. Start development servers
npm run dev
```

The frontend will run at `http://localhost:5173` and the backend at `http://localhost:5000`.

---

## 7. Automated Test Suites

```bash
# Run both Phase 2 and Phase 3 suites
npm test

# Run Phase 2 suite (Auth, RBAC, Master Data)
npm run test:phase2 --prefix backend

# Run Phase 3 suite (Core Stock Engine, FEFO, Costing, Transfers, Adjustments)
npm run test:phase3 --prefix backend
```

---

## 8. Implementation Roadmap

- [x] **Phase 1:** Foundation, Schema Migrations (001), Relational Models, Pool Health
- [x] **Phase 2:** Authentication (bcrypt, JWT), Demo OTP Resets, RBAC, Master Data CRUD (Products, Warehouses, Locations, Categories, UoM)
- [x] **Phase 3:** Core Stock Engine, Immutable Ledger (`stock_moves`), FEFO Consumption, Weighted-Average Costing Layers, Transfers, Adjustments
- [ ] **Phase 4:** Consumption-Based Reorder Suggestions & Expiry Risk Analytics ($d \times L + SS$)
- [ ] **Phase 5:** Production Polish, Seed Data, Demo Rehearsal

---

*Stockyard ERP — Modern Warehouse Logistics Engine.*
