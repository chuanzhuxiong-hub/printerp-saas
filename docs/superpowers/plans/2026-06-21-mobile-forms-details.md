# Mobile Forms And Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make common PrintERP forms and detail drawers easier to use on phones without changing any business logic.

**Architecture:** Improve shared UI primitives only. Existing pages keep their routes, form actions, server data loading, and API behavior.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, existing React components.

---

### Task 1: Responsive FormShell

**Files:**
- Modify: `src/components/form-shell.tsx`

- [x] Make the form container full-width on phones and centered on larger screens.
- [x] Increase input/select touch target size and use mobile-safe text sizing.
- [x] Make save/cancel actions stack on phones and align horizontally on larger screens.
- [x] Preserve form `action`, `method`, field names, and default values.

### Task 2: Responsive Form Sections And Detail Drawers

**Files:**
- Modify: `src/components/form-section.tsx`
- Modify: `src/components/detail-drawer.tsx`

- [x] Reduce mobile padding and keep form sections readable.
- [x] Make detail drawers full-screen on phones and side drawers on larger screens.
- [x] Preserve existing drawer open/children behavior.

### Task 3: Verification And Deployment

**Commands:**
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

**Expected:** TypeScript and production build complete successfully, then deploy to VPS and confirm `/api/health` is OK.
