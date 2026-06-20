import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const orderNo = `WEIGHT-${stamp}`;
const batchNo = `WEIGHT-BATCH-${stamp}`;
let purchase;
let batch;
let inventoryBefore;
let material;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`登录失败：${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

try {
  const cookie = await login();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  material = await db.material.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null } });
  inventoryBefore = await db.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });

  const response = await fetch(`${baseUrl}/api/purchases`, {
    method: "POST",
    headers: { cookie },
    body: new URLSearchParams({
      orderNo,
      batchNo,
      materialId: material.id,
      purchaseWeight: "1.25",
      weightUnit: "KG",
      purchaseAmount: "125",
      shippingFee: "0",
      taxFee: "0",
      discountAmount: "0"
    }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`采购入库失败：${response.status} ${await response.text()}`);

  purchase = await db.purchaseOrder.findFirstOrThrow({ where: { tenantId: tenant.id, orderNo }, include: { items: true } });
  batch = await db.materialBatch.findFirstOrThrow({ where: { tenantId: tenant.id, batchNo } });
  const inventoryAfter = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });
  const transaction = await db.inventoryTransaction.findFirstOrThrow({ where: { sourceType: "PurchaseOrder", sourceId: purchase.id } });
  const audit = await db.auditLog.findFirstOrThrow({ where: { action: "purchase.received", entityId: purchase.id } });

  if (!batch.purchaseGrams.equals(1250) || !batch.remainingGrams.equals(1250)) throw new Error("采购批次未换算为 1250g");
  if (!purchase.items[0]?.quantity.equals(1250)) throw new Error("采购明细未换算为 1250g");
  if (!transaction.quantity.equals(1250)) throw new Error("库存流水未换算为 1250g");
  const expectedInventory = inventoryBefore ? inventoryBefore.quantity.plus(1250) : batch.purchaseGrams;
  if (!inventoryAfter.quantity.equals(expectedInventory)) throw new Error(`耗材库存未增加 1250g：before=${inventoryBefore?.quantity ?? 0}, after=${inventoryAfter.quantity}, auditBefore=${audit.metadata?.beforeQuantity}`);
  if (audit.metadata?.inputWeightUnit !== "KG" || audit.metadata?.convertedGrams !== "1250") throw new Error("审计日志未记录重量换算");

  console.log("Purchase weight integration passed: 1.25kg converted to 1250g across batch, inventory and audit");
} finally {
  if (purchase) {
    await db.auditLog.deleteMany({ where: { action: "purchase.received", entityId: purchase.id } });
    await db.inventoryTransaction.deleteMany({ where: { sourceType: "PurchaseOrder", sourceId: purchase.id } });
    await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: purchase.id } });
    await db.purchaseOrder.delete({ where: { id: purchase.id } });
  }
  if (!batch) batch = await db.materialBatch.findFirst({ where: { batchNo } });
  if (batch) await db.materialBatch.delete({ where: { id: batch.id } });
  if (inventoryBefore) {
    await db.inventoryItem.update({ where: { id: inventoryBefore.id }, data: { quantity: inventoryBefore.quantity, unitCost: inventoryBefore.unitCost } });
  } else if (material) {
    await db.inventoryItem.deleteMany({ where: { category: "MATERIAL", refId: material.id } });
  }
  await db.$disconnect();
}
