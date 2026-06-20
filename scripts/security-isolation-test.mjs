import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let tenant;
let user;
let product;

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email, password }), redirect: "manual" });
  if (response.status !== 303) throw new Error(`Login failed: ${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

try {
  tenant = await db.tenant.create({ data: { name: `Isolation tenant ${stamp}`, slug: `isolation-${stamp}` } });
  user = await db.user.create({ data: { email: `isolation-${stamp}@test.local`, name: "Isolation owner", passwordHash: await bcrypt.hash("Isolation123!", 10), tenants: { create: { tenantId: tenant.id, role: "OWNER" } } } });
  product = await db.product.create({ data: { tenantId: tenant.id, name: `Private product ${stamp}` } });
  const demoCookie = await login("owner@demo.printerp.local", "PrintERP123!");

  const foreignPage = await fetch(`${baseUrl}/app/products/${product.id}`, { headers: { cookie: demoCookie }, redirect: "manual" });
  if (foreignPage.status !== 404) throw new Error(`Cross-tenant product page returned ${foreignPage.status}`);
  const foreignWrite = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie: demoCookie }, body: new URLSearchParams({ action: "generate-title", productId: product.id, platform: "PDD", keywords: "private", sellingPoints: "private" }), redirect: "manual" });
  if (foreignWrite.status < 400 || await db.productTitleVersion.count({ where: { productId: product.id } }) !== 0) throw new Error("Cross-tenant product mutation was not blocked");

  const csrf = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie: demoCookie, origin: "https://evil.example" }, body: new URLSearchParams({ action: "add-opportunity", keyword: "csrf", title: "csrf" }), redirect: "manual" });
  if (csrf.status !== 403) throw new Error(`Cross-origin write returned ${csrf.status}`);
  console.log("Security isolation passed: cross-tenant reads/writes and cross-origin writes blocked");
} finally {
  if (product) await db.product.deleteMany({ where: { id: product.id } });
  if (user) {
    await db.tenantUser.deleteMany({ where: { userId: user.id } });
    await db.user.deleteMany({ where: { id: user.id } });
  }
  if (tenant) await db.tenant.deleteMany({ where: { id: tenant.id } });
  await db.$disconnect();
}
