import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const args = process.argv.slice(2);

function argument(name) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? String(args[index + 1] ?? "").trim() : "";
}

const email = argument("email").toLowerCase();
const name = argument("name");
const password = argument("password");

try {
  if (!email || !name || password.length < 12) {
    throw new Error("Usage: --email EMAIL --name NAME --password PASSWORD (minimum 12 characters)");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('printerp:create-super-admin')::bigint)");
    const existing = await tx.platformAdmin.findUnique({ where: { email } });
    if (existing?.role === "ADMIN") throw new Error("An existing ADMIN cannot be promoted to SUPER_ADMIN");
    if (!existing) {
      const superAdminCount = await tx.platformAdmin.count({ where: { role: "SUPER_ADMIN" } });
      if (superAdminCount > 0) throw new Error("A SUPER_ADMIN already exists; initializer can only create the first one");
      return tx.platformAdmin.create({ data: { email, name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" } });
    }
    const now = new Date();
    await tx.platformAdminSession.updateMany({
      where: { platformAdminId: existing.id, revokedAt: null },
      data: { revokedAt: now }
    });
    await tx.tenantAccessGrant.updateMany({
      where: { platformAdminId: existing.id, revokedAt: null },
      data: { revokedAt: now }
    });
    return tx.platformAdmin.update({
      where: { id: existing.id },
      data: { name, passwordHash, status: "ACTIVE" }
    });
  });
  console.log(`SUPER_ADMIN ready: ${admin.email}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
