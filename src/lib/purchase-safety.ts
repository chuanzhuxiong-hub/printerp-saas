import { Prisma, PrismaClient } from "@prisma/client";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function getPurchaseSafety(tx: TransactionClient, tenantId: string, purchaseId: string) {
  const purchase = await tx.purchaseOrder.findFirstOrThrow({
    where: { id: purchaseId, tenantId, deletedAt: null },
    include: { items: true }
  });
  if (purchase.status === "CANCELLED") throw new Error("该采购单已经撤销");
  if (purchase.items.length !== 1) throw new Error("暂不支持编辑包含多条明细的采购单");
  const item = purchase.items[0];
  const inventory = await tx.inventoryItem.findUnique({
    where: { tenantId_category_refId: { tenantId, category: item.category, refId: item.materialId ?? item.packagingItemId ?? "" } }
  });
  if (!inventory) throw new Error("找不到该采购对应的库存");
  const laterTransaction = await tx.inventoryTransaction.findFirst({
    where: {
      tenantId,
      itemId: inventory.id,
      sourceId: { not: purchase.id },
      createdAt: { gt: purchase.createdAt }
    }
  });
  if (laterTransaction) throw new Error("该采购入库后已有后续库存操作，不能直接编辑或撤销；请通过库存调整修正");
  if (inventory.quantity.lt(item.quantity)) throw new Error("当前库存不足以撤销该采购");

  const creationAudit = await tx.auditLog.findFirst({
    where: { tenantId, action: item.category === "MATERIAL" ? "purchase.received" : "packaging_purchase.received", entityId: purchase.id }
  });
  let batch = null;
  if (item.category === "MATERIAL") {
    const batchId = creationAudit?.metadata && typeof creationAudit.metadata === "object" && !Array.isArray(creationAudit.metadata) ? String((creationAudit.metadata as Prisma.JsonObject).batchId ?? "") : "";
    batch = batchId ? await tx.materialBatch.findFirst({ where: { id: batchId, tenantId, deletedAt: null } }) : null;
    if (!batch) throw new Error("找不到该采购对应的耗材批次");
    if (!batch.remainingGrams.equals(batch.purchaseGrams)) throw new Error("该耗材批次已经被生产消耗，不能直接编辑或撤销");
  }
  return { purchase, item, inventory, batch, creationAudit };
}
