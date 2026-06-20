# API Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable API logging wrapper with request IDs and authenticated tenant/user context, then migrate the first high-risk business APIs.

**Architecture:** `withApiLogging()` creates one request context per API request and adds the request ID to successful responses. `requireApiSession()` enriches the same context after authentication. `logError()` emits one structured JSON error for unhandled failures.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Prisma session objects, Node `console.error`, `tsx` script tests.

---

### Task 1: Add API Logging Test

**Files:**
- Create: `scripts/api-logging-test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `scripts/api-logging-test.ts` with assertions for request ID creation, session enrichment, error logging and response header propagation.

- [ ] **Step 2: Add npm script**

Add `"test:api-logging": "tsx scripts/api-logging-test.ts"` to `package.json`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm.cmd run test:api-logging`

Expected: FAIL because `createRequestLogContext`, `attachSessionToLogContext` and `withApiLogging` do not exist yet.

### Task 2: Implement Logger and HTTP Wrapper

**Files:**
- Modify: `src/lib/logger.ts`
- Modify: `src/lib/http.ts`

- [ ] **Step 1: Implement request context helpers**

Add `createRequestLogContext()` and `attachSessionToLogContext()` to `src/lib/logger.ts`.

- [ ] **Step 2: Implement `withApiLogging()`**

Add `withApiLogging(action, handler)` to `src/lib/http.ts`. The wrapper must create context, run the handler, attach `x-request-id` to successful responses, log unknown failures and rethrow.

- [ ] **Step 3: Let `requireApiSession()` enrich context**

Add an optional context parameter to `requireApiSession(request, context)` and call `attachSessionToLogContext()` after a valid merchant session is loaded.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test:api-logging`

Expected: PASS.

### Task 3: Migrate High-Risk API Routes

**Files:**
- Modify: `src/app/api/orders/import/route.ts`
- Modify: `src/app/api/cost-imports/route.ts`
- Modify: `src/app/api/gcode/route.ts`
- Modify: `src/app/api/products/growth/route.ts`
- Modify: `src/app/api/purchases/route.ts`
- Modify: `src/app/api/purchases/packaging/route.ts`
- Modify: `src/app/api/production/[id]/complete/route.ts`
- Modify: `src/app/api/after-sales/route.ts`
- Modify: `src/app/api/shipments/route.ts`
- Modify: `src/app/api/inventory/adjustments/route.ts`

- [ ] **Step 1: Wrap route handlers**

Replace direct `export async function POST` definitions with `handlePost()` plus `export const POST = withApiLogging("<action>", handlePost)`.

- [ ] **Step 2: Pass context into auth**

Change each route to call `requireApiSession(request, logContext)`.

- [ ] **Step 3: Preserve existing validation behavior**

Keep existing validation `try/catch` branches in product growth and purchase routes so customer-facing form errors remain unchanged.

### Task 4: Verify

**Files:**
- No code files

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm.cmd run test:api-logging
npm.cmd run test:order-import
npm.cmd run test:cost-import
npm.cmd run test:gcode
```

- [ ] **Step 2: Run commercial safety checks**

Run:

```powershell
npm.cmd run build
npm.cmd run test:readiness
npm.cmd run test:security-isolation
```

Expected: all commands exit 0.
