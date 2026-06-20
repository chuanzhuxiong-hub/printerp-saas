import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
let model;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!cookie) throw new Error("Login failed");
  return cookie;
}

async function post(cookie, values) {
  const response = await fetch(`${baseUrl}/api/products/models`, { method: "POST", headers: { cookie }, body: new URLSearchParams(values), redirect: "manual" });
  if (response.status !== 303) throw new Error(`Product model request failed: ${response.status}`);
}

try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  const product = await db.product.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null }, include: { skus: true } });
  const cookie = await login();
  const name = `Model-${Date.now()}`;
  await post(cookie, { action: "create", productId: product.id, skuId: product.skus[0]?.id ?? "", name, fileUrl: "https://files.example.com/model.3mf", fileType: "3MF", printSettings: '{"layerHeight":0.2,"infill":15}', remark: "integration test" });
  model = await db.productModel.findFirstOrThrow({ where: { tenantId: tenant.id, productId: product.id, name } });
  await post(cookie, { action: "adopt", productId: product.id, modelId: model.id });
  const adopted = await db.productModel.findUniqueOrThrow({ where: { id: model.id } });
  if (!adopted.isCurrent || adopted.fileType !== "3MF" || adopted.printSettings?.layerHeight !== 0.2) throw new Error("Product model version was not adopted correctly");
  await post(cookie, { action: "archive", productId: product.id, modelId: model.id });
  const archived = await db.productModel.findUniqueOrThrow({ where: { id: model.id } });
  if (archived.status !== "ARCHIVED" || archived.isCurrent) throw new Error("Product model archive failed");
  console.log("Product model integration passed: version, print settings, adoption and archive");
} finally {
  if (model) {
    await db.auditLog.deleteMany({ where: { entityType: "ProductModel", entityId: model.id } });
    await db.productModel.delete({ where: { id: model.id } });
  }
  await db.$disconnect();
}
