BEGIN;

CREATE TYPE "PlatformAdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

CREATE TYPE "PlatformAdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "PlatformAdmin" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "PlatformAdminRole" NOT NULL,
  "status" "PlatformAdminStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAdminSession" (
  "id" TEXT NOT NULL,
  "platformAdminId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantAccessGrant" (
  "id" TEXT NOT NULL,
  "platformAdminId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "platformAdminId" TEXT NOT NULL,
  "tenantId" TEXT,
  "accessGrantId" TEXT,
  "action" TEXT NOT NULL,
  "requestMethod" TEXT,
  "requestPath" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");
CREATE INDEX "PlatformAdmin_status_role_idx" ON "PlatformAdmin"("status", "role");
CREATE INDEX "PlatformAdmin_createdByAdminId_idx" ON "PlatformAdmin"("createdByAdminId");

CREATE UNIQUE INDEX "PlatformAdminSession_tokenHash_key" ON "PlatformAdminSession"("tokenHash");
CREATE INDEX "PlatformAdminSession_platformAdminId_expiresAt_idx" ON "PlatformAdminSession"("platformAdminId", "expiresAt");
CREATE INDEX "PlatformAdminSession_expiresAt_idx" ON "PlatformAdminSession"("expiresAt");

CREATE INDEX "TenantAccessGrant_platformAdminId_expiresAt_idx" ON "TenantAccessGrant"("platformAdminId", "expiresAt");
CREATE INDEX "TenantAccessGrant_tenantId_expiresAt_idx" ON "TenantAccessGrant"("tenantId", "expiresAt");

CREATE INDEX "PlatformAuditLog_platformAdminId_createdAt_idx" ON "PlatformAuditLog"("platformAdminId", "createdAt");
CREATE INDEX "PlatformAuditLog_tenantId_createdAt_idx" ON "PlatformAuditLog"("tenantId", "createdAt");
CREATE INDEX "PlatformAuditLog_accessGrantId_idx" ON "PlatformAuditLog"("accessGrantId");
CREATE INDEX "PlatformAuditLog_entityType_entityId_idx" ON "PlatformAuditLog"("entityType", "entityId");

ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminSession" ADD CONSTRAINT "PlatformAdminSession_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantAccessGrant" ADD CONSTRAINT "TenantAccessGrant_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantAccessGrant" ADD CONSTRAINT "TenantAccessGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_accessGrantId_fkey" FOREIGN KEY ("accessGrantId") REFERENCES "TenantAccessGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
