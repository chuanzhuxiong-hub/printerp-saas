import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let user;
let membership;

try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  user = await db.user.create({ data: { email: `session-${stamp}@test.local`, name: "Session test", passwordHash: await bcrypt.hash("SessionTest123!", 10) } });
  membership = await db.tenantUser.create({ data: { tenantId: tenant.id, userId: user.id, role: "WAREHOUSE" } });
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: user.email, password: "SessionTest123!" }), redirect: "manual" });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  if ((await fetch(`${baseUrl}/app/inventory`, { headers: { cookie }, redirect: "manual" })).status !== 200) throw new Error("Active employee session was rejected");
  await db.tenantUser.update({ where: { id: membership.id }, data: { status: "DISABLED" } });
  const disabled = await fetch(`${baseUrl}/app/inventory`, { headers: { cookie }, redirect: "manual" });
  if (disabled.status !== 307 || !disabled.headers.get("location")?.includes("/app/login")) throw new Error("Disabled employee session remained active");
  console.log("Session invalidation passed: disabled employee session is rejected immediately");
} finally {
  if (membership) await db.tenantUser.deleteMany({ where: { id: membership.id } });
  if (user) await db.user.deleteMany({ where: { id: user.id } });
  await db.$disconnect();
}
