# Mobile List Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make core business lists readable on phones by rendering `DataTable` rows as mobile cards while preserving desktop tables.

**Architecture:** Keep existing page data and row definitions unchanged. `DataTable` maps headers and row cells into mobile key-value cards on small screens, and keeps the original table on `sm` and larger screens.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, existing React components.

---

### Task 1: DataTable Mobile Cards

**Files:**
- Modify: `src/components/data-table.tsx`

- [x] Render mobile cards for each table row on small screens.
- [x] Use first column as card title and remaining columns as labeled fields.
- [x] Preserve desktop table rendering and align-right behavior.
- [x] Preserve existing empty and loading states.

### Task 2: Product Center Responsive Rows

**Files:**
- Modify: `src/app/app/products/page.tsx`

- [x] Make product summary rows stack on mobile instead of using fixed desktop grid columns.
- [x] Keep SKU expanded table horizontally scrollable as a fallback for this phase.

### Task 3: Verification

**Commands:**
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

**Expected:** TypeScript and production build complete successfully.
