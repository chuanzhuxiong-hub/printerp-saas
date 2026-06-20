# Tenant and Role Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block confirmed account takeover, privilege escalation, stale-role page access, and cross-tenant relationship injection.

**Architecture:** Centralize route role policies in one module, enforce current database roles in the application layout, constrain merchant employee APIs, and validate every confirmed vulnerable relationship ID before writes.

**Tech Stack:** Next.js 15, TypeScript, Prisma 6, PostgreSQL, Node integration scripts

---

### Task 1: Convert Boundary Audit Into Regression Test

**Files:**
- Modify: `scripts/security-boundary-audit-test.mjs`

- [ ] Replace diagnostic logging with assertions requiring attacks to be blocked.
- [ ] Run `npm.cmd run test:security-boundaries`.
- [ ] Confirm failure identifies account takeover, cross-tenant shop injection, and stale-role page access.

### Task 2: Centralize Role Policy and Enforce Current Page Role

**Files:**
- Create: `src/lib/permissions.ts`
- Modify: `src/lib/http.ts`
- Modify: `src/middleware.ts`
- Modify: `src/app/app/layout.tsx`

- [ ] Define shared page and API role policies.
- [ ] Make API authorization use shared policies.
- [ ] Make middleware authentication-only.
- [ ] Enforce current database role in application layout.

### Task 3: Secure Employee Management

**Files:**
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`

- [ ] Prevent employee creation from overwriting existing user credentials.
- [ ] Allow managers to assign only operational roles.
- [ ] Prevent merchant APIs from assigning `PLATFORM_ADMIN`.
- [ ] Prevent managers from assigning or modifying owners.

### Task 4: Validate Tenant Relationships

**Files:**
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/materials/route.ts`
- Modify: `src/app/api/materials/[id]/route.ts`
- Modify: `src/app/api/printer-parts/route.ts`
- Modify: `src/app/api/tool-assets/route.ts`
- Modify: `src/app/api/purchases/packaging/route.ts`

- [ ] Validate every supplied relationship ID belongs to the current tenant.
- [ ] Fail before writing business records when an ID is foreign or deleted.

### Task 5: Verify Security Boundary

**Files:**
- Modify only if verification exposes defects.

- [ ] Run boundary security regression.
- [ ] Run existing isolation, session invalidation, content permission, and data management tests.
- [ ] Run production build.
- [ ] Re-scan user-supplied relationship IDs and merchant role assignment paths.
