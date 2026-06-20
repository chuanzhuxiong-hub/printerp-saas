import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
let product;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  if (response.status !== 303) throw new Error(`Login failed: ${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(cookie, values) {
  const response = await fetch(`${baseUrl}/api/products/growth`, { method: "POST", headers: { cookie }, body: new URLSearchParams(values), redirect: "manual" });
  if (response.status !== 303) throw new Error(`Request failed: ${response.status} ${await response.text()}`);
}

try {
  const cookie = await login();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  product = await db.product.create({ data: { tenantId: tenant.id, name: `Competitor monitoring test ${stamp}`, category: "Test" } });
  await post(cookie, { action: "add-competitor", productId: product.id, platform: "PDD", competitorUrl: `https://example.com/monitor/${stamp}`, title: "Original title", mainImageUrl: "https://example.com/old.jpg", currentPrice: "29.90", salesDisplayValue: "Sold 10k+", salesEstimate: "10000", salesActual: "50", reviewCount: "100" });
  const competitor = await db.productCompetitor.findFirstOrThrow({ where: { productId: product.id } });

  await post(cookie, { action: "update-competitor", productId: product.id, competitorId: competitor.id, platform: "PDD", competitorUrl: competitor.competitorUrl, title: "Updated title", mainImageUrl: "https://example.com/new.jpg", currentPrice: "19.90", salesDisplayValue: "Sold 20k+", salesEstimate: "20000", salesActual: "60", reviewCount: "200", activityInfo: "New promotion" });
  const updated = await db.productCompetitor.findUniqueOrThrow({ where: { id: competitor.id }, include: { snapshots: true, alerts: true } });
  if (updated.snapshots.length !== 2) throw new Error("Every manual update must create a snapshot");
  for (const expected of ["PRICE_DROP", "ACTIVITY_CHANGE", "TITLE_CHANGE", "IMAGE_CHANGE", "SALES_DISPLAY_CHANGE"]) {
    if (!updated.alerts.some(alert => alert.alertType === expected)) throw new Error(`Missing alert: ${expected}`);
  }
  if (updated.salesDisplayValue !== "Sold 20k+" || !updated.salesEstimate?.equals(20000) || !updated.salesActual?.equals(60)) throw new Error("Sales fields were mixed during update");

  await post(cookie, { action: "toggle-competitor", productId: product.id, competitorId: competitor.id });
  if ((await db.productCompetitor.findUniqueOrThrow({ where: { id: competitor.id } })).status !== "INACTIVE") throw new Error("Competitor deactivation failed");
  await post(cookie, { action: "toggle-competitor", productId: product.id, competitorId: competitor.id });
  console.log("Competitor monitoring integration passed: update snapshots, change alerts, sales semantics, activate/deactivate");
} finally {
  if (product) {
    const competitors = await db.productCompetitor.findMany({ where: { productId: product.id }, select: { id: true } });
    const competitorIds = competitors.map(item => item.id);
    await db.competitorAlert.deleteMany({ where: { competitorId: { in: competitorIds } } });
    await db.competitorSnapshot.deleteMany({ where: { competitorId: { in: competitorIds } } });
    await db.productCompetitor.deleteMany({ where: { productId: product.id } });
    await db.auditLog.deleteMany({ where: { entityId: product.id } });
    await db.product.delete({ where: { id: product.id } });
  }
  await db.$disconnect();
}
