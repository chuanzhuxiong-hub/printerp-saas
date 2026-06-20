import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
let afterSale;
let productBefore;
let packagingBefore = [];
let effectivePackagingBefore = [];

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!cookie || !response.headers.get("location")?.includes("/app/dashboard")) throw new Error("Login failed");
  return cookie;
}

try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  const orders = await db.salesOrder.findMany({
    where: { tenantId: tenant.id, deletedAt: null, items: { some: { skuId: { not: null } } } },
    include: { items: { include: { sku: { include: { bom: { include: { items: true } } } } } } },
    orderBy: { createdAt: "asc" }
  });
  let order;
  let orderItem;
  let sku;
  for (const candidate of orders) {
    const candidateItem = candidate.items.find(item => item.sku);
    if (!candidateItem?.sku) continue;
    const packagingRefs = (candidateItem.sku.bom?.items ?? []).filter(item => item.category === "PACKAGING").map(item => item.refId);
    const [inventoryCount, productInventoryCount] = await Promise.all([
      db.inventoryItem.count({ where: { tenantId: tenant.id, category: "PACKAGING", refId: { in: packagingRefs }, deletedAt: null } }),
      db.inventoryItem.count({ where: { tenantId: tenant.id, category: "PRODUCT", refId: candidateItem.sku.id, deletedAt: null } })
    ]);
    if (inventoryCount !== packagingRefs.length || productInventoryCount !== 1) continue;
    order = candidate;
    orderItem = candidateItem;
    sku = candidateItem.sku;
    break;
  }
  if (!order || !orderItem || !sku) throw new Error("No order with complete product and packaging inventory found");
  productBefore = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "PRODUCT", refId: sku.id } } });
  const packagingItems = (sku.bom?.items ?? []).filter(item => item.category === "PACKAGING");
  packagingBefore = await db.inventoryItem.findMany({ where: { tenantId: tenant.id, category: "PACKAGING", refId: { in: packagingItems.map(item => item.refId) } } });
  if (productBefore.quantity.lt(1)) await db.inventoryItem.update({ where: { id: productBefore.id }, data: { quantity: 1 } });
  for (const bomItem of packagingItems) {
    const before = packagingBefore.find(item => item.refId === bomItem.refId);
    if (before.quantity.lt(bomItem.quantity)) await db.inventoryItem.update({ where: { id: before.id }, data: { quantity: bomItem.quantity } });
  }
  const effectiveProductBefore = await db.inventoryItem.findUniqueOrThrow({ where: { id: productBefore.id } });
  effectivePackagingBefore = await db.inventoryItem.findMany({ where: { id: { in: packagingBefore.map(item => item.id) } } });
  const cookie = await login();
  const reason = `After-sale inventory test ${Date.now()}`;
  const response = await fetch(`${baseUrl}/api/after-sales`, {
    method: "POST", headers: { cookie }, redirect: "manual",
    body: new URLSearchParams({ salesOrderId: order.id, type: "RESEND_PRODUCT", reason, resendSkuId: sku.id, resendQuantity: "1", refundAmount: "0", resendShippingCost: "5", returnShippingCost: "0", scrapCost: "0", platformPenalty: "0", laborCost: "0" })
  });
  if (response.status !== 303 || !response.headers.get("location")?.includes(`/app/orders/${order.id}`)) throw new Error(`After-sale request failed: ${response.status}`);
  afterSale = await db.afterSale.findFirstOrThrow({ where: { tenantId: tenant.id, salesOrderId: order.id, reason }, include: { items: true } });
  const productAfter = await db.inventoryItem.findUniqueOrThrow({ where: { id: productBefore.id } });
  const rows = await db.inventoryTransaction.findMany({ where: { sourceType: "AfterSale", sourceId: afterSale.id } });
  if (!productAfter.quantity.equals(effectiveProductBefore.quantity.minus(1)) || !afterSale.resendProductCost.equals(productBefore.unitCost)) throw new Error("After-sale product inventory or cost mismatch");
  if (!afterSale.items[0] || rows.length !== 1 + packagingItems.length || rows.some(row => row.type !== "AFTERSALE_RESEND_OUT")) throw new Error("After-sale inventory ledger is incomplete");
  for (const bomItem of packagingItems) {
    const before = effectivePackagingBefore.find(item => item.refId === bomItem.refId);
    const current = await db.inventoryItem.findUniqueOrThrow({ where: { id: before.id } });
    if (!current.quantity.equals(before.quantity.minus(bomItem.quantity))) throw new Error("After-sale packaging inventory mismatch");
  }
  console.log("After-sale inventory integration passed: product and BOM packaging deducted with immutable ledger");
} finally {
  if (afterSale) {
    const rows = await db.inventoryTransaction.findMany({ where: { sourceType: "AfterSale", sourceId: afterSale.id } });
    for (const row of rows) if (row.itemId) await db.inventoryItem.update({ where: { id: row.itemId }, data: { quantity: { decrement: row.quantity } } });
    await db.inventoryTransaction.deleteMany({ where: { sourceType: "AfterSale", sourceId: afterSale.id } });
    await db.costRecord.deleteMany({ where: { sourceType: "AfterSale", sourceId: afterSale.id } });
    await db.auditLog.deleteMany({ where: { entityType: "AfterSale", entityId: afterSale.id } });
    await db.afterSaleItem.deleteMany({ where: { afterSaleId: afterSale.id } });
    await db.afterSale.delete({ where: { id: afterSale.id } });
  }
  if (productBefore) await db.inventoryItem.update({ where: { id: productBefore.id }, data: { quantity: productBefore.quantity, unitCost: productBefore.unitCost } });
  for (const item of packagingBefore) await db.inventoryItem.update({ where: { id: item.id }, data: { quantity: item.quantity, unitCost: item.unitCost } });
  await db.$disconnect();
}
