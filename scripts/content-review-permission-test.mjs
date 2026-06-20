import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let user;
let product;
let title;

try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  user = await db.user.create({ data: { email: `production-review-${stamp}@test.local`, name: "Permission test", passwordHash: await bcrypt.hash("Permission123!", 10), tenants: { create: { tenantId: tenant.id, role: "PRODUCTION" } } } });
  product = await db.product.create({ data: { tenantId: tenant.id, name: `Permission product ${stamp}` } });
  title = await db.productTitleVersion.create({ data: { tenantId: tenant.id, productId: product.id, platform: "PDD", title: "Permission title" } });
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: user.email, password: "Permission123!" }), redirect: "manual" });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  const response = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie }, body: new URLSearchParams({ action: "adopt-content", productId: product.id, contentType: "title", contentId: title.id }), redirect: "manual" });
  if (response.status !== 400) throw new Error(`Production user should not review content, received ${response.status}`);
  if ((await db.productTitleVersion.findUniqueOrThrow({ where: { id: title.id } })).isCurrent) throw new Error("Unauthorized content adoption was persisted");
  console.log("Content review permission passed: production role cannot approve or adopt content");
} finally {
  if (title) await db.productTitleVersion.delete({ where: { id: title.id } });
  if (product) await db.product.delete({ where: { id: product.id } });
  if (user) {
    await db.tenantUser.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await db.$disconnect();
}
