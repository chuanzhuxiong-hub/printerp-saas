# Platform Admin Isolation and PostgreSQL RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated platform administrator backend with audited 30-minute tenant maintenance access, then enforce PostgreSQL RLS on the first group of core tenant tables.

**Architecture:** Platform administrators use dedicated models, sessions, cookies, routes, and authorization helpers. A valid temporary access grant creates an owner-equivalent maintenance context while retaining the real administrator identity. Core business access moves through a tenant-scoped Prisma transaction helper that sets `app.tenant_id`; production database roles separate application access from migration access.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 6, PostgreSQL 16, jose, bcryptjs, Docker Compose, Node integration tests.

---

## File Structure

- `prisma/schema.prisma`: platform administrator, session, access grant, and platform audit models.
- `prisma/migrations/20260611_platform_admin_isolation/migration.sql`: platform administrator schema migration.
- `prisma/migrations/20260611_core_tenant_rls/migration.sql`: application role and first-wave RLS policies.
- `src/lib/platform-auth.ts`: platform session creation, validation, revocation, and maintenance-context resolution.
- `src/lib/tenant-db.ts`: tenant-scoped Prisma transaction helper that sets `app.tenant_id`.
- `src/lib/audit.ts`: dual merchant/platform audit support.
- `src/middleware.ts`: `/admin` and `/app` cookie boundary enforcement.
- `src/app/admin/*`: platform login, tenant list, access grants, audit view, health, and administrator management.
- `src/app/api/admin/*`: platform authentication, grant, and administrator management APIs.
- `src/components/maintenance-banner.tsx`: visible maintenance mode and expiry indicator.
- `scripts/platform-admin-isolation-test.mjs`: platform identity and route-boundary regression.
- `scripts/platform-maintenance-access-test.mjs`: grant expiry, tenant restriction, and dual-audit regression.
- `scripts/rls-core-isolation-test.mjs`: direct database RLS regression.
- `scripts/create-super-admin.mjs`: server-only first super-administrator initializer.
- `package.json`: platform security test and initializer scripts.
- `docker-compose.yml`: local migration/application role setup.
- `docker-compose.prod.yml`: production database role separation.

### Task 1: Add Platform Administrator Data Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260611_platform_admin_isolation/migration.sql`
- Create: `scripts/platform-admin-model-test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing model test**

Create a test that asserts Prisma exposes `platformAdmin`, `platformAdminSession`, `tenantAccessGrant`, and `platformAuditLog`, and that a platform administrator can exist without a `TenantUser`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:platform-admin:model`

Expected: FAIL because the platform administrator models do not exist.

- [ ] **Step 3: Add minimal schema and migration**

Add enums `PlatformAdminRole` and `PlatformAdminStatus`, plus the four approved models and indexes. Do not add a relationship from `PlatformAdmin` to `TenantUser`.

- [ ] **Step 4: Generate Prisma client and run migration**

Run: `npx.cmd prisma generate`

Run: `npx.cmd prisma migrate deploy`

Expected: Prisma client generation and migration succeed.

- [ ] **Step 5: Run model test**

Run: `npm.cmd run test:platform-admin:model`

Expected: PASS and test cleanup removes created records.

### Task 2: Build Dedicated Platform Authentication

**Files:**
- Create: `src/lib/platform-auth.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/api/admin/auth/login/route.ts`
- Create: `src/app/api/admin/auth/logout/route.ts`
- Create: `scripts/platform-admin-isolation-test.mjs`
- Modify: `src/middleware.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing route-boundary test**

Test these behaviors:

- merchant cookie cannot access `/admin`
- platform cookie cannot access `/app` without a grant
- active platform administrator can log in
- disabled platform administrator login fails

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:platform-admin:isolation`

Expected: FAIL because `/admin/login` and platform authentication do not exist.

- [ ] **Step 3: Implement platform sessions**

Use cookie `printerp_admin_session`. Store only a random token hash in `PlatformAdminSession`. Resolve every request against the database so disabled administrators and revoked sessions fail immediately.

- [ ] **Step 4: Implement login/logout and middleware boundaries**

Add separate `/admin` handling and ensure platform sessions are not treated as merchant sessions.

- [ ] **Step 5: Run isolation test**

Run: `npm.cmd run test:platform-admin:isolation`

Expected: PASS.

### Task 3: Add Super Administrator Management

**Files:**
- Create: `scripts/create-super-admin.mjs`
- Create: `src/app/admin/admins/page.tsx`
- Create: `src/app/api/admin/admins/route.ts`
- Create: `src/app/api/admin/admins/[id]/route.ts`
- Create: `scripts/platform-admin-management-test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing administrator-management test**

Assert:

- `ADMIN` receives `403` when creating, disabling, or resetting an administrator
- `SUPER_ADMIN` can create and disable an `ADMIN`
- platform backend cannot create another `SUPER_ADMIN`
- disabling an administrator revokes their sessions and grants

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:platform-admin:management`

Expected: FAIL because management APIs do not exist.

- [ ] **Step 3: Implement server initializer**

Add `npm.cmd run admin:create-super -- --email ... --name ... --password ...`. It creates or resets the first `SUPER_ADMIN` directly through the management database connection.

- [ ] **Step 4: Implement management UI and APIs**

Allow only `SUPER_ADMIN` to create, disable, and reset `ADMIN` accounts. Prevent API creation or promotion to `SUPER_ADMIN`.

- [ ] **Step 5: Run management test**

Run: `npm.cmd run test:platform-admin:management`

Expected: PASS.

### Task 4: Add Audited Temporary Tenant Access

**Files:**
- Create: `src/app/admin/tenants/page.tsx`
- Create: `src/app/admin/grants/page.tsx`
- Create: `src/app/api/admin/grants/route.ts`
- Create: `src/app/api/admin/grants/[id]/revoke/route.ts`
- Create: `src/components/maintenance-banner.tsx`
- Create: `scripts/platform-maintenance-access-test.mjs`
- Modify: `src/lib/platform-auth.ts`
- Modify: `src/app/app/layout.tsx`
- Modify: `src/lib/http.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing grant test**

Assert:

- empty maintenance reason returns `400`
- a grant expires exactly 30 minutes after creation
- a valid grant allows target tenant owner-equivalent access
- the grant cannot access another tenant
- revoked and expired grants fail immediately
- only one active grant remains per administrator

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:platform-admin:maintenance`

Expected: FAIL because grant APIs and maintenance context do not exist.

- [ ] **Step 3: Implement access grant APIs and context**

Create grants with a server-calculated `expiresAt`. Resolve maintenance requests to `{ role: "OWNER", actorType: "PLATFORM_ADMIN", platformAdminId, accessGrantId, tenantId, reason, expiresAt }`.

- [ ] **Step 4: Show maintenance banner**

Display platform maintenance mode, reason, target merchant, and expiry in the merchant layout.

- [ ] **Step 5: Run grant test**

Run: `npm.cmd run test:platform-admin:maintenance`

Expected: PASS.

### Task 5: Add Immutable Dual Audit

**Files:**
- Modify: `src/lib/audit.ts`
- Create: `src/lib/platform-audit.ts`
- Create: `src/app/admin/audit/page.tsx`
- Create: `src/app/admin/health/page.tsx`
- Modify: `scripts/platform-maintenance-access-test.mjs`

- [ ] **Step 1: Extend failing maintenance test**

Assert a platform maintenance write creates:

- a merchant `AuditLog`
- a `PlatformAuditLog`
- matching administrator, tenant, grant, reason, method, path, entity, and IP metadata

Assert platform APIs cannot update or delete `PlatformAuditLog`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:platform-admin:maintenance`

Expected: FAIL because dual audit is missing.

- [ ] **Step 3: Implement audit helpers and read-only views**

Centralize platform audit writes and add read-only audit and health pages. Exclude passwords, raw cookies, session tokens, and full sensitive request bodies.

- [ ] **Step 4: Run maintenance test**

Run: `npm.cmd run test:platform-admin:maintenance`

Expected: PASS.

### Task 6: Introduce Tenant-Scoped Prisma Execution

**Files:**
- Create: `src/lib/tenant-db.ts`
- Create: `scripts/tenant-db-test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tenant database helper test**

Assert `withTenantDb(tenantId, callback)` sets `current_setting('app.tenant_id', true)` for the callback and clears it after the transaction.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:tenant-db`

Expected: FAIL because `withTenantDb` does not exist.

- [ ] **Step 3: Implement tenant transaction helper**

Validate tenant IDs as non-empty strings, start an interactive Prisma transaction, execute `SELECT set_config('app.tenant_id', tenantId, true)`, then invoke the callback.

- [ ] **Step 4: Run helper test**

Run: `npm.cmd run test:tenant-db`

Expected: PASS.

### Task 7: Add First-Wave PostgreSQL RLS

**Files:**
- Create: `prisma/migrations/20260611_core_tenant_rls/migration.sql`
- Create: `scripts/rls-core-isolation-test.mjs`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `package.json`

- [ ] **Step 1: Write failing direct database RLS test**

Using the application database role, assert:

- no tenant setting returns zero core-table rows
- no tenant setting rejects writes
- tenant A context cannot read, update, delete, or insert tenant B records
- tenant A context can operate on tenant A records

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:rls-core`

Expected: FAIL because the application role and policies do not exist.

- [ ] **Step 3: Add database roles and policies**

Create an application role without `BYPASSRLS`, grant only required schema/table/sequence permissions, enable and force RLS on the approved first-wave tables, and add `USING` plus `WITH CHECK` tenant policies.

- [ ] **Step 4: Separate application and migration database URLs**

Use `DATABASE_URL` for the application role and `MIGRATION_DATABASE_URL` for Prisma migration, seed, and controlled maintenance.

- [ ] **Step 5: Deploy migration and run RLS test**

Run: `npx.cmd prisma migrate deploy`

Run: `npm.cmd run test:rls-core`

Expected: PASS.

### Task 8: Move Core Business Paths Behind Tenant RLS

**Files:**
- Modify: `src/lib/dashboard.ts`
- Modify: `src/lib/profit.ts`
- Modify: `src/lib/inventory.ts`
- Modify: `src/lib/data-reset.ts`
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/orders/import/route.ts`
- Modify: `src/app/api/purchases/route.ts`
- Modify: `src/app/api/purchases/[id]/route.ts`
- Modify: `src/app/api/after-sales/route.ts`
- Modify: relevant core page query files under `src/app/app`
- Modify: existing integration tests as needed to use the management connection for setup and cleanup

- [ ] **Step 1: Run existing core tests against RLS to identify unscoped access**

Run sequentially:

```powershell
npm.cmd run test:security-boundaries
npm.cmd run test:security-isolation
npm.cmd run test:commercial
npm.cmd run test:purchase-edit-cancel:integration
npm.cmd run test:after-sales-inventory:integration
```

Expected: FAIL where core paths access protected tables through global `db`.

- [ ] **Step 2: Convert each failing core path**

Wrap protected-table work in `withTenantDb(session.tenantId, async tx => ...)`. Keep multi-write business operations in the same tenant transaction.

- [ ] **Step 3: Re-run each converted flow**

Run the same sequential commands after each small conversion.

Expected: Converted flow passes without weakening RLS.

- [ ] **Step 4: Scan for direct protected-table access**

Run an `rg` scan for first-wave model delegates used through global `db`; review every result and migrate business requests or explicitly document management-only scripts.

- [ ] **Step 5: Run all core tests**

Expected: PASS.

### Task 9: Full Verification and Deployment

**Files:**
- Modify: `scripts/release-check.ps1`
- Modify: `README.md` or deployment documentation

- [ ] **Step 1: Add new security tests to acceptance gate**

Include model, isolation, management, maintenance, tenant-db, and RLS tests in the release check.

- [ ] **Step 2: Run complete test suite sequentially**

Run:

```powershell
npm.cmd run test:platform-admin:model
npm.cmd run test:platform-admin:isolation
npm.cmd run test:platform-admin:management
npm.cmd run test:platform-admin:maintenance
npm.cmd run test:tenant-db
npm.cmd run test:rls-core
npm.cmd run test:security-boundaries
npm.cmd run test:security-isolation
npm.cmd run test:session-invalidation
npm.cmd run test:content-review:permission
npm.cmd run test:data-management:safety
npm.cmd run test:commercial
npm.cmd run test:security-audit
npm.cmd run build
```

Expected: all commands pass.

- [ ] **Step 3: Build and restart Docker**

Run: `docker compose up -d --build`

Expected: application and PostgreSQL containers become healthy.

- [ ] **Step 4: Run post-deployment security tests**

Run platform administrator, maintenance, RLS, tenant isolation, and commercial tests again.

Expected: PASS against deployed containers.

- [ ] **Step 5: Document operational procedures**

Document first super-administrator initialization, database role secrets, migration URL handling, access grant audit review, and emergency administrator revocation.
