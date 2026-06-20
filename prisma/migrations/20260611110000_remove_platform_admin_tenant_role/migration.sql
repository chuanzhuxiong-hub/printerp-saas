BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TenantUser"
    WHERE "role"::text = 'PLATFORM_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Cannot remove PLATFORM_ADMIN from UserRole: TenantUser rows still use this role';
  END IF;
END
$$;

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM (
  'OWNER',
  'MANAGER',
  'PRODUCTION',
  'WAREHOUSE',
  'FINANCE',
  'SUPPORT'
);

ALTER TABLE "TenantUser" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "TenantUser"
  ALTER COLUMN "role" TYPE "UserRole"
  USING ("role"::text::"UserRole");
ALTER TABLE "TenantUser" ALTER COLUMN "role" SET DEFAULT 'OWNER';

DROP TYPE "UserRole_old";

COMMIT;
