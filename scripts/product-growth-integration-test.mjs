import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let product;
let opportunity;
let convertedProduct;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  if (response.status !== 303) throw new Error(`登录失败：${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(cookie, values) {
  const response = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie }, body: new URLSearchParams(values), redirect: "manual" });
  if (response.status !== 303) throw new Error(`提交失败：${response.status} ${await response.text()}`);
}

try {
  const cookie = await login();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  product = await db.product.create({ data: { tenantId: tenant.id, name: `增长测试产品-${stamp}`, category: "测试" } });

  await post(cookie, { action: "generate-title", productId: product.id, platform: "拼多多", keywords: "桌面,收纳,3D打印", sellingPoints: "轻巧,可定制" });
  await post(cookie, { action: "generate-detail", productId: product.id, platform: "拼多多", keywords: "桌面,收纳", sellingPoints: "轻巧,可定制", audience: "办公用户", scenarios: "桌面" });
  await post(cookie, { action: "create-image-workflow", productId: product.id, platform: "拼多多", assetType: "白底主图", sellingPoints: "轻巧,可定制" });
  if (await db.productTitleVersion.count({ where: { productId: product.id } }) !== 3) throw new Error("标题候选版本未保存");
  if (await db.productDetailVersion.count({ where: { productId: product.id } }) !== 1) throw new Error("详情页版本未保存");
  if (await db.productContentAsset.count({ where: { productId: product.id } }) !== 1) throw new Error("主图工作流未保存");

  for (let index = 1; index <= 5; index++) {
    await post(cookie, { action: "add-competitor", productId: product.id, platform: "拼多多", competitorUrl: `https://example.com/${stamp}/${index}`, title: `竞品 ${index}`, currentPrice: "29.90", salesDisplayValue: "已拼1万+", salesEstimate: "12000", salesActual: "88", reviewCount: "100" });
  }
  const competitors = await db.productCompetitor.findMany({ where: { productId: product.id }, include: { snapshots: true } });
  if (competitors.length !== 5 || competitors.some(item => item.snapshots.length !== 1)) throw new Error("竞品上限或快照记录错误");
  if (competitors.some(item => item.salesDisplayValue !== "已拼1万+" || !item.salesEstimate?.equals(12000) || !item.salesActual?.equals(88))) throw new Error("三种销量口径未分开保存");
  const sixth = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie }, body: new URLSearchParams({ action: "add-competitor", productId: product.id, platform: "拼多多", competitorUrl: `https://example.com/${stamp}/6` }), redirect: "manual" });
  if (sixth.status < 400) throw new Error("第 6 个竞品未被阻止");

  await post(cookie, { action: "add-opportunity", keyword: "桌面收纳", platform: "拼多多", title: `选品测试-${stamp}`, price: "39.90", estimatedCost: "10", salesDisplayValue: "已售5000+", salesEstimate: "5000", salesActual: "0", reviewCount: "100", competitorCount: "5", printDifficultyScore: "20", afterSaleRiskScore: "10" });
  opportunity = await db.productOpportunity.findFirstOrThrow({ where: { tenantId: tenant.id, title: `选品测试-${stamp}` } });
  if (opportunity.opportunityScore.lte(0) || !opportunity.aiRecommendation) throw new Error("选品半自动分析未生成");
  await post(cookie, { action: "convert-opportunity", opportunityId: opportunity.id });
  opportunity = await db.productOpportunity.findUniqueOrThrow({ where: { id: opportunity.id } });
  convertedProduct = await db.product.findUniqueOrThrow({ where: { id: opportunity.convertedProductId } });
  if (convertedProduct.isActive || opportunity.status !== "CONVERTED") throw new Error("选品转产品草稿失败");
  console.log("Product growth integration passed: content workflows, 5-competitor cap, sales semantics, opportunity analysis");
} finally {
  if (convertedProduct) await db.product.delete({ where: { id: convertedProduct.id } });
  if (opportunity) await db.productOpportunity.delete({ where: { id: opportunity.id } });
  if (product) {
    const competitors = await db.productCompetitor.findMany({ where: { productId: product.id }, select: { id: true } });
    await db.competitorSnapshot.deleteMany({ where: { competitorId: { in: competitors.map(item => item.id) } } });
    await db.productCompetitor.deleteMany({ where: { productId: product.id } });
    await db.productTitleVersion.deleteMany({ where: { productId: product.id } });
    await db.productDetailVersion.deleteMany({ where: { productId: product.id } });
    await db.productContentAsset.deleteMany({ where: { productId: product.id } });
    await db.productAiGenerationJob.deleteMany({ where: { productId: product.id } });
    await db.auditLog.deleteMany({ where: { entityId: product.id } });
    await db.product.delete({ where: { id: product.id } });
  }
  await db.$disconnect();
}
