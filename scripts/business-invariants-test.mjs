import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }),
    redirect: "manual"
  });
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(path, cookie, values) {
  return fetch(`${baseUrl}${path}`, { method: "POST", headers: { cookie }, body: new URLSearchParams(values), redirect: "manual" });
}

const cookie = await login();
const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
const sku = await db.productSku.findFirstOrThrow({
  where: { tenantId: tenant.id, skuCode: "POT-WHITE-S", deletedAt: null, bom: { isNot: null } },
  include: { bom: true }
});
const material = await db.material.findUniqueOrThrow({ where: { id: sku.bom.defaultMaterialId } });
const materialInventoryBefore = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });
const batchBefore = await db.materialBatch.aggregate({ where: { tenantId: tenant.id, materialId: material.id, status: "NORMAL", deletedAt: null }, _sum: { remainingGrams: true } });
const productInventoryBefore = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "PRODUCT", refId: sku.id } } });

const orderNo = `PR-INVARIANT-${Date.now()}`;
await post("/api/production", cookie, { orderNo, skuId: sku.id, plannedQuantity: "1" });
const production = await db.productionOrder.findFirstOrThrow({ where: { tenantId: tenant.id, orderNo } });
const completeResponse = await post(`/api/production/${production.id}/complete`, cookie, {
  completedQuantity: "1", failedQuantity: "0", actualMaterialGrams: "1", actualPrintHours: "0"
});
if (completeResponse.status !== 303) throw new Error(`生产完工失败：${completeResponse.status}`);

const materialInventoryAfter = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "MATERIAL", refId: material.id } } });
const batchAfter = await db.materialBatch.aggregate({ where: { tenantId: tenant.id, materialId: material.id, deletedAt: null }, _sum: { remainingGrams: true } });
const productInventoryAfter = await db.inventoryItem.findUniqueOrThrow({ where: { tenantId_category_refId: { tenantId: tenant.id, category: "PRODUCT", refId: sku.id } } });
if (!materialInventoryAfter.quantity.eq(materialInventoryBefore.quantity.minus(1))) throw new Error("生产消耗未扣减耗材库存");
if (!(batchAfter._sum.remainingGrams ?? 0).equals((batchBefore._sum.remainingGrams ?? 0).minus(1))) throw new Error("生产消耗未同步扣减耗材批次");
if (!productInventoryAfter.quantity.eq(productInventoryBefore.quantity.plus(1))) throw new Error("生产完工未增加成品库存");

const adjustmentItem = await db.inventoryItem.findFirstOrThrow({ where: { tenantId: tenant.id, category: "PACKAGING", deletedAt: null } });
const adjustmentBefore = adjustmentItem.quantity;
await post("/api/inventory/adjustments", cookie, { itemId: adjustmentItem.id, type: "STOCK_GAIN", quantity: "1", remark: "自动化不变量测试" });
await post("/api/inventory/adjustments", cookie, { itemId: adjustmentItem.id, type: "STOCK_LOSS", quantity: "1", remark: "自动化不变量测试恢复" });
const adjustmentAfter = await db.inventoryItem.findUniqueOrThrow({ where: { id: adjustmentItem.id } });
if (!adjustmentAfter.quantity.eq(adjustmentBefore)) throw new Error("库存调整往返后数量未恢复");
const invalidResponse = await post("/api/inventory/adjustments", cookie, { itemId: adjustmentItem.id, type: "STOCK_LOSS", quantity: "999999999", remark: "负库存保护测试" });
const adjustmentFinal = await db.inventoryItem.findUniqueOrThrow({ where: { id: adjustmentItem.id } });
if (invalidResponse.status < 400 || !adjustmentFinal.quantity.eq(adjustmentBefore)) throw new Error("负库存保护未生效");

await db.$disconnect();
console.log("PrintERP business invariant test passed: batch, inventory, negative-stock protection");
