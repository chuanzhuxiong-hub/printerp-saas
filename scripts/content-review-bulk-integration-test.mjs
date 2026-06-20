import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let product;
let opportunityIds = [];
let convertedProductIds = [];

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  if (response.status !== 303) throw new Error(`Login failed: ${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(cookie, values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) Array.isArray(value) ? value.forEach(item => body.append(key, item)) : body.set(key, value);
  const response = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie }, body, redirect: "manual" });
  if (response.status !== 303) throw new Error(`Request failed: ${response.status} ${await response.text()}`);
}

try {
  const cookie = await login();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  product = await db.product.create({ data: { tenantId: tenant.id, name: `Content review test ${stamp}`, category: "Test" } });
  await post(cookie, { action: "generate-title", productId: product.id, platform: "PDD", keywords: "desk,storage", sellingPoints: "lightweight" });
  await post(cookie, { action: "generate-detail", productId: product.id, platform: "PDD", keywords: "desk", sellingPoints: "lightweight" });
  await post(cookie, { action: "create-image-workflow", productId: product.id, platform: "PDD", assetType: "MAIN", sellingPoints: "lightweight" });
  const title = await db.productTitleVersion.findFirstOrThrow({ where: { productId: product.id } });
  const detail = await db.productDetailVersion.findFirstOrThrow({ where: { productId: product.id } });
  const asset = await db.productContentAsset.findFirstOrThrow({ where: { productId: product.id } });
  await post(cookie, { action: "adopt-content", productId: product.id, contentType: "title", contentId: title.id });
  await post(cookie, { action: "adopt-content", productId: product.id, contentType: "detail", contentId: detail.id });
  await post(cookie, { action: "adopt-content", productId: product.id, contentType: "asset", contentId: asset.id });
  if (!(await db.productTitleVersion.findUniqueOrThrow({ where: { id: title.id } })).isCurrent) throw new Error("Title was not adopted");
  if (!(await db.productDetailVersion.findUniqueOrThrow({ where: { id: detail.id } })).isCurrent) throw new Error("Detail was not adopted");
  if ((await db.productContentAsset.findUniqueOrThrow({ where: { id: asset.id } })).usageStatus !== "ACTIVE") throw new Error("Asset was not adopted");

  for (const index of [1, 2]) await post(cookie, { action: "add-opportunity", keyword: `bulk-${stamp}`, platform: "PDD", title: `Bulk opportunity ${stamp}-${index}`, price: "39.9", estimatedCost: "10", printDifficultyScore: "20", afterSaleRiskScore: "10" });
  opportunityIds = (await db.productOpportunity.findMany({ where: { tenantId: tenant.id, keyword: `bulk-${stamp}` }, select: { id: true } })).map(item => item.id);
  await post(cookie, { action: "bulk-opportunity-status", opportunityIds, status: "SHORTLISTED" });
  if (await db.productOpportunity.count({ where: { id: { in: opportunityIds }, status: "SHORTLISTED" } }) !== 2) throw new Error("Bulk opportunity status failed");
  await post(cookie, { action: "bulk-convert-opportunities", opportunityIds });
  const converted = await db.productOpportunity.findMany({ where: { id: { in: opportunityIds } } });
  convertedProductIds = converted.map(item => item.convertedProductId).filter(Boolean);
  if (converted.some(item => item.status !== "CONVERTED") || convertedProductIds.length !== 2) throw new Error("Bulk conversion failed");
  console.log("Content review and opportunity bulk integration passed");
} finally {
  if (convertedProductIds.length) await db.product.deleteMany({ where: { id: { in: convertedProductIds } } });
  if (opportunityIds.length) await db.productOpportunity.deleteMany({ where: { id: { in: opportunityIds } } });
  if (product) {
    await db.productTitleVersion.deleteMany({ where: { productId: product.id } });
    await db.productDetailVersion.deleteMany({ where: { productId: product.id } });
    await db.productContentAsset.deleteMany({ where: { productId: product.id } });
    await db.productAiGenerationJob.deleteMany({ where: { productId: product.id } });
    await db.auditLog.deleteMany({ where: { entityId: product.id } });
    await db.product.delete({ where: { id: product.id } });
  }
  await db.$disconnect();
}
