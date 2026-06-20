# Performance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the SaaS performance foundation before adding background queues by reducing large synchronous page queries and repeated live aggregation.

**Architecture:** Keep the current Next.js Server Component and Prisma structure. Add small shared helpers for pagination and dashboard caching, then update high-risk pages incrementally: orders, products, dashboard, and reporting pages. Background job queues are intentionally out of scope for this plan.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, TypeScript, existing script-based tests.

---

### Task 1: Orders List Pagination

**Files:**
- Create: `src/lib/pagination.ts`
- Modify: `src/app/app/orders/page.tsx`
- Test: `scripts/performance-foundation-test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a pagination helper**

Create `parsePagination(searchParams, defaults)` returning `{ page, pageSize, skip, take }`, with bounds to prevent unbounded queries.

- [ ] **Step 2: Update orders page**

Read `page` and `pageSize` from query string, use `skip` and `take`, and render previous/next links with current result counts.

- [ ] **Step 3: Add assertions**

Add script assertions that the orders page source contains `skip`, `take`, and page links, and that the old fixed `take: 100` pattern is gone.

### Task 2: Products Page Pagination and Lazy Detail Loading

**Files:**
- Modify: `src/app/app/products/page.tsx`
- Create: `src/app/app/products/[id]/skus/page.tsx`
- Test: `scripts/performance-foundation-test.ts`

- [ ] **Step 1: Split product list data**

For the product library tab, query products with counts and lightweight metadata only. Do not include all SKU rows or BOM rows in the listing.

- [ ] **Step 2: Add SKU detail route**

Create a product SKU detail page that loads SKU/BOM/inventory for a single product when the user clicks into it.

- [ ] **Step 3: Keep AI, competitor, and opportunity tabs usable**

Only load heavier AI/competitor/opportunity data when their tab is active.

### Task 3: Dashboard Short Cache

**Files:**
- Modify: `src/lib/dashboard.ts`
- Test: `scripts/performance-foundation-test.ts`

- [ ] **Step 1: Add tenant-level in-memory TTL cache**

Cache dashboard metric results for 60 seconds per tenant. Return cloned plain data so callers cannot mutate cached state.

- [ ] **Step 2: Keep recent 7-day chart query separate**

Leave the 7-day chart query on the dashboard page for now, but cap it by date range and keep it indexed by tenant/date.

### Task 4: Report Query Guardrails

**Files:**
- Modify: `src/app/app/reports/sku-profit/page.tsx`
- Modify: `src/app/app/reports/shop-profit/page.tsx`
- Modify: `src/app/app/reports/purchases/page.tsx`
- Test: `scripts/performance-foundation-test.ts`

- [ ] **Step 1: Add date windows and row caps**

Default heavy reports to recent 12 months or capped result sets. Keep tenant filters on every query.

- [ ] **Step 2: Prefer select over include**

Reduce loaded columns and relations where the page only needs a few fields.

### Task 5: Verification

**Files:**
- Test: `scripts/performance-foundation-test.ts`

- [ ] **Step 1: Run static performance checks**

Run `npm run test:performance-foundation`.

- [ ] **Step 2: Build and smoke critical pages**

Run `npm run build`, then smoke-check orders, products, dashboard, and reports through the existing app.
