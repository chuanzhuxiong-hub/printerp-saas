# Import Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move order and cost import requests into background jobs so large files do not block foreground HTTP requests.

**Architecture:** Import APIs validate and persist uploaded files, enqueue `BackgroundJob` records, and redirect to the task center. Worker processors load persisted files and call shared import service functions.

**Tech Stack:** Next.js App Router, Prisma, existing `BackgroundJob` model, Node filesystem APIs, `tsx` script tests.

---

### Task 1: Import Job Utilities

**Files:**
- Create: `src/lib/import-job-files.ts`
- Create: `scripts/import-job-test.ts`
- Modify: `package.json`

- [ ] Write a failing test that expects import job processors and file persistence helpers.
- [ ] Implement `saveJobUpload()` and `readJobUpload()`.
- [ ] Add `npm run test:import-jobs`.

### Task 2: Import Services

**Files:**
- Create: `src/lib/order-import-service.ts`
- Create: `src/lib/cost-import-service.ts`
- Modify: `src/app/api/orders/import/route.ts`
- Modify: `src/app/api/cost-imports/route.ts`

- [ ] Move order import business logic into `importOrdersFromBytes()`.
- [ ] Move cost import business logic into `importCostsFromBytes()`.
- [ ] Keep route behavior equivalent until job enqueue is added.

### Task 3: Job Processors

**Files:**
- Modify: `src/lib/job-processors.ts`

- [ ] Register `ORDER_IMPORT`.
- [ ] Register `COST_IMPORT`.
- [ ] Each processor validates payload, reads file bytes and returns summary JSON.

### Task 4: Enqueue From Routes

**Files:**
- Modify: `src/app/api/orders/import/route.ts`
- Modify: `src/app/api/cost-imports/route.ts`

- [ ] API saves upload to `uploads/jobs`.
- [ ] API enqueues the matching job type.
- [ ] API redirects to `/app/jobs?queued=<jobId>`.

### Task 5: Verify

**Files:**
- No code files

- [ ] Run `npm.cmd run test:import-jobs`.
- [ ] Run `npm.cmd run test:background-jobs`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `npm.cmd run test:smoke`.
- [ ] Run `npm.cmd run test:security-isolation`.
