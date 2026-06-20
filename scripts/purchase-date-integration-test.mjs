import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const selectedDate = "2026-05-15";
const materialOrderNo = `DATE-M-${stamp}`;
const batchNo = `DATE-B-${stamp}`;
const packagingOrderNo = `DATE-P-${stamp}`;
let materialPurchase;
let packagingPurchase;
let batch;
let materialInventoryBefore;
let packagingInventoryBefore;
let packagingBefore;
let material;
let packaging;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`登录失败：${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(cookie, path, values) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie },
    body: new URLSearchParams(values),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`${path} 提交失败：${response.status} ${await response.text()}`);
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

try {
  const cookie = await login();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  material = await db.material.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null } });
  packaging = await db.packagingItem.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null } });
  materialInventoryBefore = await db.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });
  packagingInventoryBefore = await db.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "PACKAGING", refId: packaging.id } } });
  packagingBefore = { quantity: packaging.quantity, unitPrice: packaging.unitPrice };

  await post(cookie, "/api/purchases", {
    orderNo: materialOrderNo,
    batchNo,
    materialId: material.id,
    purchaseDate: selectedDate,
    purchaseWeight: "0.1",
    weightUnit: "KG",
    purchaseAmount: "10",
    shippingFee: "0",
    taxFee: "0",
    discountAmount: "0"
  });
  await post(cookie, "/api/purchases/packaging", {
    orderNo: packagingOrderNo,
    packagingItemId: packaging.id,
    purchaseDate: selectedDate,
    quantity: "1",
    purchaseAmount: "1",
    shippingFee: "0",
    taxFee: "0",
    discountAmount: "0"
  });

  materialPurchase = await db.purchaseOrder.findFirstOrThrow({ where: { tenantId: tenant.id, orderNo: materialOrderNo } });
  packagingPurchase = await db.purchaseOrder.findFirstOrThrow({ where: { tenantId: tenant.id, orderNo: packagingOrderNo } });
  batch = await db.materialBatch.findFirstOrThrow({ where: { tenantId: tenant.id, batchNo } });
  const materialTransaction = await db.inventoryTransaction.findFirstOrThrow({ where: { sourceType: "PurchaseOrder", sourceId: materialPurchase.id } });
  const packagingTransaction = await db.inventoryTransaction.findFirstOrThrow({ where: { sourceType: "PurchaseOrder", sourceId: packagingPurchase.id } });

  for (const [name, value] of [
    ["耗材采购单", materialPurchase.purchaseDate],
    ["耗材批次", batch.purchasedAt],
    ["耗材入库流水", materialTransaction.createdAt],
    ["包装采购单", packagingPurchase.purchaseDate],
    ["包装入库流水", packagingTransaction.createdAt]
  ]) {
    if (dateOnly(value) !== selectedDate) throw new Error(`${name} 未使用选择的采购日期`);
  }

  console.log("Purchase date integration passed: material, batch, packaging and inventory transactions use selected historical date");
} finally {
  if (!materialPurchase) materialPurchase = await db.purchaseOrder.findFirst({ where: { orderNo: materialOrderNo } });
  if (!packagingPurchase) packagingPurchase = await db.purchaseOrder.findFirst({ where: { orderNo: packagingOrderNo } });
  for (const purchase of [materialPurchase, packagingPurchase].filter(Boolean)) {
    await db.auditLog.deleteMany({ where: { entityType: "PurchaseOrder", entityId: purchase.id } });
    await db.inventoryTransaction.deleteMany({ where: { sourceType: "PurchaseOrder", sourceId: purchase.id } });
    await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: purchase.id } });
    await db.purchaseOrder.delete({ where: { id: purchase.id } });
  }
  if (!batch) batch = await db.materialBatch.findFirst({ where: { batchNo } });
  if (batch) await db.materialBatch.delete({ where: { id: batch.id } });
  if (materialInventoryBefore) {
    await db.inventoryItem.update({ where: { id: materialInventoryBefore.id }, data: { quantity: materialInventoryBefore.quantity, unitCost: materialInventoryBefore.unitCost } });
  } else if (material) {
    await db.inventoryItem.deleteMany({ where: { category: "MATERIAL", refId: material.id } });
  }
  if (packagingInventoryBefore) {
    await db.inventoryItem.update({ where: { id: packagingInventoryBefore.id }, data: { quantity: packagingInventoryBefore.quantity, unitCost: packagingInventoryBefore.unitCost } });
  } else if (packaging) {
    await db.inventoryItem.deleteMany({ where: { category: "PACKAGING", refId: packaging.id } });
  }
  if (packaging && packagingBefore) {
    await db.packagingItem.update({ where: { id: packaging.id }, data: packagingBefore });
  }
  await db.$disconnect();
}
