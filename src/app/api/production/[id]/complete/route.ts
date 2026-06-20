import { InventoryCategory, InventoryTransactionType, Prisma, ProductionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateOrderProfit } from "@/lib/profit";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const { id } = await context.params;
  const form = await request.formData();
  const completedQuantity = Math.max(0, Number.parseInt(text(form, "completedQuantity"), 10) || 0);
  const failedQuantity = Math.max(0, Number.parseInt(text(form, "failedQuantity"), 10) || 0);
  const actualMaterialGrams = new Prisma.Decimal(decimalText(form, "actualMaterialGrams"));
  const actualPrintHours = new Prisma.Decimal(decimalText(form, "actualPrintHours"));
  const failureReason = text(form, "failureReason") || null;

  await db.$transaction(async (tx) => {
    const production = await tx.productionOrder.findFirstOrThrow({
      where: { id, tenantId: session.tenantId, deletedAt: null }
    });
    if (!production.skuId) throw new Error("生产任务未关联 SKU");
    const sku = await tx.productSku.findFirstOrThrow({ where: { id: production.skuId, tenantId: session.tenantId, deletedAt: null } });
    const bom = await tx.productBom.findFirst({ where: { skuId: sku.id, tenantId: session.tenantId, deletedAt: null } });
    const materialId = text(form, "materialId") || bom?.defaultMaterialId;
    if (!materialId) throw new Error("生产任务未选择耗材");

    const materialInventory = await tx.inventoryItem.findUniqueOrThrow({
      where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.MATERIAL, refId: materialId } }
    });
    if (materialInventory.quantity.lessThan(actualMaterialGrams)) throw new Error("耗材库存不足");

    const printer = production.printerId
      ? await tx.printer.findFirst({ where: { id: production.printerId, tenantId: session.tenantId, deletedAt: null } })
      : null;
    const materialCost = actualMaterialGrams.mul(materialInventory.unitCost);
    const machineCost = actualPrintHours.mul(printer?.depreciationPerHour ?? 0);
    const laborCost = (bom?.laborMinutes ?? new Prisma.Decimal(0)).mul(bom?.laborCostPerMinute ?? 0).mul(completedQuantity);
    const electricityCost = (bom?.electricityCost ?? new Prisma.Decimal(0)).mul(completedQuantity);
    const actualCost = materialCost.plus(machineCost).plus(laborCost).plus(electricityCost);
    const productUnitCost = completedQuantity > 0 ? actualCost.div(completedQuantity) : new Prisma.Decimal(0);

    const materialAfter = materialInventory.quantity.minus(actualMaterialGrams);
    const batches = await tx.materialBatch.findMany({
      where: { tenantId: session.tenantId, materialId, status: "NORMAL", remainingGrams: { gt: 0 }, deletedAt: null },
      orderBy: { purchasedAt: "asc" }
    });
    const availableBatchGrams = batches.reduce((sum, batch) => sum.plus(batch.remainingGrams), new Prisma.Decimal(0));
    if (availableBatchGrams.lt(actualMaterialGrams)) throw new Error("耗材批次剩余量不足");
    let remainingToConsume = actualMaterialGrams;
    const batchUsage: Array<{ batchId: string; grams: string }> = [];
    for (const batch of batches) {
      if (remainingToConsume.lte(0)) break;
      const used = Prisma.Decimal.min(batch.remainingGrams, remainingToConsume);
      const remainingGrams = batch.remainingGrams.minus(used);
      await tx.materialBatch.update({
        where: { id: batch.id },
        data: { remainingGrams, status: remainingGrams.eq(0) ? "DEPLETED" : "NORMAL", updatedBy: session.userId }
      });
      batchUsage.push({ batchId: batch.id, grams: used.toString() });
      remainingToConsume = remainingToConsume.minus(used);
    }
    await tx.inventoryItem.update({ where: { id: materialInventory.id }, data: { quantity: materialAfter, updatedBy: session.userId } });
    await tx.inventoryTransaction.create({
      data: {
        tenantId: session.tenantId, itemId: materialInventory.id, category: InventoryCategory.MATERIAL, refId: materialId,
        type: InventoryTransactionType.PRODUCTION_CONSUME, quantity: actualMaterialGrams.neg(), unitCost: materialInventory.unitCost,
        totalCost: materialCost.neg(), sourceType: "ProductionOrder", sourceId: production.id, createdBy: session.userId
      }
    });

    if (completedQuantity > 0) {
      const productInventory = await tx.inventoryItem.upsert({
        where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PRODUCT, refId: sku.id } },
        create: {
          tenantId: session.tenantId, category: InventoryCategory.PRODUCT, refId: sku.id, name: sku.name,
          quantity: completedQuantity, warningStock: sku.warningStock, unitCost: productUnitCost, createdBy: session.userId
        },
        update: { quantity: { increment: completedQuantity }, unitCost: productUnitCost, updatedBy: session.userId }
      });
      await tx.inventoryTransaction.create({
        data: {
          tenantId: session.tenantId, itemId: productInventory.id, category: InventoryCategory.PRODUCT, refId: sku.id,
          type: InventoryTransactionType.PRODUCTION_IN, quantity: completedQuantity, unitCost: productUnitCost,
          totalCost: actualCost, sourceType: "ProductionOrder", sourceId: production.id, createdBy: session.userId
        }
      });
    }

    await tx.productionOrder.update({
      where: { id: production.id },
      data: {
        completedQuantity, failedQuantity, actualMaterialGrams, actualPrintHours, actualCost, failureReason,
        status: completedQuantity > 0 ? ProductionStatus.STOCKED : ProductionStatus.FAILED,
        endedAt: new Date(), updatedBy: session.userId
      }
    });
    await tx.productionOrderItem.updateMany({
      where: { productionOrderId: production.id, tenantId: session.tenantId },
      data: { completedQuantity, failedQuantity }
    });
    if (failedQuantity > 0) {
      await tx.printFailure.create({
        data: {
          tenantId: session.tenantId, productionOrderId: production.id, reason: failureReason ?? "其他",
          quantity: failedQuantity, materialLossGrams: actualMaterialGrams, costLoss: materialCost, createdBy: session.userId
        }
      });
    }
    await tx.costRecord.create({
      data: {
        tenantId: session.tenantId, sourceType: "ProductionOrder", sourceId: production.id, salesOrderId: production.salesOrderId,
        skuId: sku.id, productionOrderId: production.id, materialBatchId: batchUsage[0]?.batchId ?? null, printerId: production.printerId,
        amount: actualCost, remark: "生产实际成本", createdBy: session.userId
      }
    });

    if (production.salesOrderId) {
      const order = await tx.salesOrder.findFirstOrThrow({ where: { id: production.salesOrderId, tenantId: session.tenantId, deletedAt: null } });
      const productCost = order.productCost.plus(actualCost);
      const profit = calculateOrderProfit({ ...order, productCost });
      await tx.salesOrder.update({ where: { id: order.id }, data: { productCost, ...profit } });
    }
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId, userId: session.userId, action: "production.completed", entityType: "ProductionOrder",
        entityId: production.id, metadata: { completedQuantity, failedQuantity, actualCost: actualCost.toString(), batchUsage }
      }
    });
  });
  return NextResponse.redirect(new URL("/app/production", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("production.complete", handlePost);
