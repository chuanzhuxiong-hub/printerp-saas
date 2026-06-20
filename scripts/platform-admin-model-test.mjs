import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";

const db = new PrismaClient();
const uniqueId = randomUUID();
const email = `platform-admin-model-${uniqueId}@test.local`;
let adminId;
let tenantId;

try {
  assert.equal("PLATFORM_ADMIN" in UserRole, false, "UserRole must not allow platform administrators as tenant members");

  const admin = await db.platformAdmin.create({
    data: {
      email,
      name: "Platform model test",
      passwordHash: "test-only-password-hash",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;

  assert.equal(await db.user.count({ where: { email } }), 0, "PlatformAdmin must not require a User record");
  assert.equal(await db.tenantUser.findFirst({ where: { user: { email } } }), null, "PlatformAdmin must not have a TenantUser identity");

  const tenant = await db.tenant.create({
    data: { name: `Platform model tenant ${uniqueId}`, slug: `platform-model-${uniqueId}` },
  });
  tenantId = tenant.id;

  const session = await db.platformAdminSession.create({
    data: {
      platformAdminId: admin.id,
      tokenHash: `hash-${uniqueId}`,
      ipAddress: "127.0.0.1",
      userAgent: "platform-admin-model-test",
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  assert.equal("token" in session, false, "PlatformAdminSession must not expose a raw token field");

  const grant = await db.tenantAccessGrant.create({
    data: {
      platformAdminId: admin.id,
      tenantId: tenant.id,
      reason: "Model verification",
      ipAddress: "127.0.0.1",
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      tenantId: tenant.id,
      accessGrantId: grant.id,
      action: "MODEL_TEST",
      requestMethod: "POST",
      requestPath: "/test/platform-admin-model",
      entityType: "TenantAccessGrant",
      entityId: grant.id,
      metadata: { test: true },
      ipAddress: "127.0.0.1",
    },
  });

  const columns = await db.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('PlatformAdminSession', 'PlatformAuditLog')
  `;
  const sessionColumns = columns.filter((column) => column.table_name === "PlatformAdminSession").map((column) => column.column_name);
  const auditColumns = columns.filter((column) => column.table_name === "PlatformAuditLog").map((column) => column.column_name);

  assert.equal(sessionColumns.includes("tokenHash"), true, "PlatformAdminSession must persist tokenHash");
  assert.equal(sessionColumns.includes("token"), false, "PlatformAdminSession must not persist raw token");
  assert.equal(auditColumns.includes("updatedAt"), false, "PlatformAuditLog must be application-layer immutable");

  const foreignKeys = await db.$queryRaw`
    SELECT
      tc.constraint_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = tc.constraint_schema
      AND rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_schema = 'public'
      AND tc.constraint_name IN (
        'TenantAccessGrant_platformAdminId_fkey',
        'PlatformAuditLog_accessGrantId_fkey'
      )
  `;
  const deleteRules = new Map(foreignKeys.map((foreignKey) => [foreignKey.constraint_name, foreignKey.delete_rule]));
  assert.equal(deleteRules.get("TenantAccessGrant_platformAdminId_fkey"), "RESTRICT", "Deleting an admin must not cascade-delete access grants");
  assert.equal(deleteRules.get("PlatformAuditLog_accessGrantId_fkey"), "RESTRICT", "Deleting an access grant must not detach platform audit logs");

  console.log("Platform admin model passed: isolated identity, hashed sessions, grants and immutable audit schema verified");
} finally {
  if (adminId) {
    await db.platformAuditLog.deleteMany({ where: { platformAdminId: adminId } });
    await db.tenantAccessGrant.deleteMany({ where: { platformAdminId: adminId } });
    await db.platformAdminSession.deleteMany({ where: { platformAdminId: adminId } });
    await db.platformAdmin.deleteMany({ where: { id: adminId } });
  }
  if (tenantId) await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
}
