# Mobile Dashboard Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dashboard and profit reports more readable as mobile business dashboards without changing report calculations.

**Architecture:** Improve shared metric card styling and responsive layout classes in Dashboard/profit report pages. Keep all Prisma queries, Decimal calculations, and report data flows unchanged.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, existing React components.

---

### Task 1: Mobile Metric Cards

**Files:**
- Modify: `src/components/metric-card.tsx`
- Modify: `src/components/trend-indicator.tsx`

- [x] Reduce phone padding and allow descriptions/trends to wrap cleanly.
- [x] Keep desktop card behavior and tone colors.
- [x] Fix trend arrow display so it is readable.

### Task 2: Dashboard Mobile Layout

**Files:**
- Modify: `src/app/app/dashboard/page.tsx`

- [x] Use two-column metric cards on small phones where possible.
- [x] Make profit trend rows stack on phones and keep desktop grid on larger screens.
- [x] Improve mobile spacing for todo/ranking cards.

### Task 3: Profit Report Mobile Layout

**Files:**
- Modify: `src/app/app/reports/profit/page.tsx`

- [x] Use mobile-friendly metric card grids and reduce section padding.
- [x] Keep all report calculations unchanged.

### Task 4: Verification And Deployment

**Commands:**
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

**Expected:** TypeScript and production build complete successfully, then deploy to VPS and confirm `/api/health` is OK.
