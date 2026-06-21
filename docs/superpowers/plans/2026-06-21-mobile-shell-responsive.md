# Mobile Shell Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PrintERP app shell usable on phones by adding a mobile navigation drawer, responsive header/container spacing, and a global table overflow fallback.

**Architecture:** Keep all business pages and server data fetching unchanged. Add a small client-side `AppFrame` that owns mobile menu state, reuses the existing `Sidebar` and `AppHeader`, and wraps existing page content.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, existing shadcn-style components.

---

### Task 1: Mobile App Shell

**Files:**
- Create: `src/components/app-frame.tsx`
- Modify: `src/app/app/layout.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/app-header.tsx`

- [x] Add a client `AppFrame` that renders desktop sidebar on large screens and a slide-in drawer on small screens.
- [x] Add a mobile menu button to `AppHeader`.
- [x] Let `Sidebar` support desktop and mobile modes without changing navigation permissions.
- [x] Keep session, tenant and permission logic inside the existing server layout.

### Task 2: Responsive Containers

**Files:**
- Modify: `src/components/page-shell.tsx`
- Modify: `src/components/page-header.tsx`

- [x] Reduce phone padding and make page header actions stack cleanly.
- [x] Prevent long titles/descriptions from forcing horizontal overflow.

### Task 3: Table Overflow Fallback

**Files:**
- Modify: `src/components/data-table.tsx`

- [x] Keep desktop table behavior.
- [x] Add mobile horizontal scrolling and a short scroll hint.
- [x] Avoid changing table data rendering or business behavior.

### Task 4: Verification

**Commands:**
- `npx tsc --noEmit`
- `npm run build`

**Expected:** TypeScript and production build complete successfully.
