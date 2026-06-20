import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const orderNo = `EDIT-${stamp}`;
const editedOrderNo = `EDITED-${stamp}`;
const batchNo = `EDIT-BATCH-${stamp}`;
const editedBatchNo = `EDITED-BATCH-${stamp}`;
let purchase;
let material;
let inventoryBefore;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }),
    redirect: "manual"
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (response.status !== 303 || !response.headers.get("location")?.includes("/app/dashboard") || !cookie) {
    throw new Error(`Login failed: ${response.status} ${response.headers.get("location")}`);
  }
  return cookie;
}

async function post(cookie, path, values) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie },
    body: new URLSearchParams(values),
    redirect: "manual"
  });
  const location = response.headers.get("location") ?? "";
  if (response.status !== 303 || location.includes("error=")) {
    throw new Error(`${path} request failed: ${response.status} ${location} ${await response.text()}`);
  }
  return response;
}

try {
  const cookie = await login();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  material = await db.material.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null } });
  inventoryBefore = await db.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });

  await post(cookie, "/api/purchases", {
    orderNo, batchNo, materialId: material.id, purchaseDate: "2026-05-10",
    purchaseWeight: "1", weightUnit: "KG", purchaseAmount: "100", shippingFee: "0", taxFee: "0", discountAmount: "0"
  });
  purchase = await db.purchaseOrder.findFirstOrThrow({ where: { tenantId: tenant.id, orderNo } });

  await post(cookie, `/api/purchases/${purchase.id}`, {
    action: "update", orderNo: editedOrderNo, batchNo: editedBatchNo, purchaseDate: "2026-05-11",
    purchaseWeight: "1.5", weightUnit: "KG", purchaseAmount: "180", shippingFee: "20", taxFee: "0", discountAmount: "0"
  });

  const edited = await db.purchaseOrder.findUniqueOrThrow({ where: { id: purchase.id }, include: { items: true } });
  const batch = await db.materialBatch.findFirstOrThrow({ where: { tenantId: tenant.id, batchNo: editedBatchNo } });
  const inventoryEdited = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });
  if (edited.orderNo !== editedOrderNo || !edited.totalCost.equals(200) || !edited.items[0]?.quantity.equals(1500)) throw new Error("Purchase update did not persist");
  if (!batch.purchaseGrams.equals(1500) || !batch.remainingGrams.equals(1500) || !batch.totalCost.equals(200)) throw new Error("Purchase update did not synchronize material batch");
  const originalQuantity = inventoryBefore?.quantity ?? new Prisma.Decimal(0);
  if (!inventoryEdited.quantity.equals(originalQuantity.plus(1500))) throw new Error("Purchase update did not synchronize inventory");

  await post(cookie, `/api/purchases/${purchase.id}`, { action: "cancel" });
  const cancelled = await db.purchaseOrder.findUniqueOrThrow({ where: { id: purchase.id } });
  const inventoryAfter = await db.inventoryItem.findUniqueOrThrow({ where: { id: inventoryEdited.id } });
  const cancelledBatch = await db.materialBatch.findFirstOrThrow({ where: { id: batch.id } });
  const reversal = await db.inventoryTransaction.findFirst({ where: { sourceType: "PurchaseCancellation", sourceId: purchase.id } });
  if (cancelled.status !== "CANCELLED" || !cancelledBatch.deletedAt || !reversal) throw new Error("Purchase cancellation records are incomplete");
  const originalUnitCost = inventoryBefore?.unitCost ?? new Prisma.Decimal(0);
  if (!inventoryAfter.quantity.equals(originalQuantity) || !inventoryAfter.unitCost.equals(originalUnitCost)) throw new Error("Purchase cancellation did not restore inventory quantity and cost");

  console.log("Purchase edit/cancel integration passed: edit synchronized and cancellation restored inventory cost");
} finally {
  if (!purchase) purchase = await db.purchaseOrder.findFirst({ where: { OR: [{ orderNo }, { orderNo: editedOrderNo }] } });
  if (purchase) {
    await db.auditLog.deleteMany({ where: { entityType: "PurchaseOrder", entityId: purchase.id } });
    await db.inventoryTransaction.deleteMany({ where: { OR: [{ sourceType: "PurchaseOrder", sourceId: purchase.id }, { sourceType: "PurchaseCancellation", sourceId: purchase.id }] } });
    await db.materialBatch.deleteMany({ where: { OR: [{ batchNo }, { batchNo: editedBatchNo }] } });
    await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: purchase.id } });
    await db.purchaseOrder.delete({ where: { id: purchase.id } });
  }
  if (inventoryBefore) {
    await db.inventoryItem.update({ where: { id: inventoryBefore.id }, data: { quantity: inventoryBefore.quantity, unitCost: inventoryBefore.unitCost } });
  } else if (material) {
    await db.inventoryItem.deleteMany({ where: { category: "MATERIAL", refId: material.id } });
  }
  await db.$disconnect();
}
