BEGIN;

ALTER TABLE "TenantAccessGrant"
  DROP CONSTRAINT "TenantAccessGrant_platformAdminId_fkey",
  ADD CONSTRAINT "TenantAccessGrant_platformAdminId_fkey"
    FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlatformAuditLog"
  DROP CONSTRAINT "PlatformAuditLog_accessGrantId_fkey",
  ADD CONSTRAINT "PlatformAuditLog_accessGrantId_fkey"
    FOREIGN KEY ("accessGrantId") REFERENCES "TenantAccessGrant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
