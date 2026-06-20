# Inventory and Cost Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make inventory mutations concurrency-safe and ledger-reconcilable while preserving immutable order-cost history.

**Architecture:** Add transaction-aware inventory mutation helpers and a pure reconciliation module. Migrate high-risk stock-out routes to those helpers inside serializable transactions, add an idempotent opening-balance repair script, and make initial/imported costs append-only.

**Tech Stack:** Next.js 15, TypeScript, Prisma 6, PostgreSQL, Node integration scripts

---

### Task 1: Reconciliation Calculations

**Files:**
- Create: `src/lib/inventory-reconciliation.ts`
- Create: `scripts/inventory-reconciliation-test.ts`
- Modify: `package.json`

- [ ] Write a failing test proving zero balances without ledger entries reconcile and non-zero differences are reported.
- [ ] Run `npx tsx scripts/inventory-reconciliation-test.ts` and verify it fails because the module does not exist.
- [ ] Implement pure reconciliation calculation functions using `Prisma.Decimal`.
- [ ] Run `npx tsx scripts/inventory-reconciliation-test.ts` and verify it passes.

### Task 2: Transaction-Aware Inventory Service

**Files:**
- Modify: `src/lib/inventory.ts`
- Create: `scripts/inventory-service-integration-test.mjs`
- Modify: `package.json`

- [ ] Write an integration test that decrements stock, verifies one matching ledger entry, and verifies insufficient stock rolls back.
- [ ] Run the integration test and verify it fails because the transaction-aware API does not exist.
- [ ] Implement `increaseInventory`, `decreaseInventory`, and `adjustInventory` against a passed Prisma transaction client.
- [ ] Run the integration test and verify it passes.

### Task 3: Migrate High-Risk Stock-Out Routes

**Files:**
- Modify: `src/app/api/shipments/route.ts`
- Modify: `src/app/api/after-sales/route.ts`
- Modify: `src/app/api/inventory/scan/route.ts`
- Modify: `src/app/api/inventory/adjustments/route.ts`

- [ ] Replace direct balance writes and ledger inserts with inventory service calls.
- [ ] Run existing after-sales and business-invariant integration tests.
- [ ] Confirm routes use serializable transaction isolation.

### Task 4: Opening Balance Repair

**Files:**
- Create: `scripts/repair-inventory-ledger.ts`
- Modify: `prisma/seed.ts`
- Modify: `package.json`

- [ ] Add a test case proving repair deltas are idempotently identified.
- [ ] Implement a repair command that appends mismatch deltas without altering history.
- [ ] Update seed data to append opening-balance transactions for all seeded non-zero balances.
- [ ] Run reconciliation before and after repair and require zero non-zero mismatches.

### Task 5: Append-Only Cost History

**Files:**
- Modify: `src/app/api/cost-imports/route.ts`
- Modify: `src/app/api/orders/route.ts`
- Create: `scripts/order-cost-traceability-integration-test.mjs`
- Modify: `package.json`

- [ ] Write an integration test proving manual order creation writes initial component records.
- [ ] Write an integration test proving repeated cost import appends history instead of overwriting.
- [ ] Implement initial component cost records and append-only imported cost records.
- [ ] Run the traceability integration tests.

### Task 6: Verification

**Files:**
- Modify only if verification exposes defects.

- [ ] Run inventory reconciliation tests.
- [ ] Run inventory service integration tests.
- [ ] Run after-sales and business-invariant tests.
- [ ] Run cost traceability tests.
- [ ] Run `npm run build`.
- [ ] Review direct `InventoryItem.quantity` writes and document remaining migration candidates.
