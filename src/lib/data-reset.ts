import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

async function clearOperationalData(tx: TransactionClient, tenantId: string) {
  await tx.backgroundJob.deleteMany({ where: { tenantId } });
  await tx.afterSaleItem.deleteMany({ where: { tenantId } });
  await tx.refund.deleteMany({ where: { tenantId } });
  await tx.reshipment.deleteMany({ where: { tenantId } });
  await tx.afterSale.deleteMany({ where: { tenantId } });
  await tx.shipmentItem.deleteMany({ where: { tenantId } });
  await tx.shippingCost.deleteMany({ where: { tenantId } });
  await tx.shipment.deleteMany({ where: { tenantId } });
  await tx.salesOrderItem.deleteMany({ where: { tenantId } });
  await tx.salesOrder.deleteMany({ where: { tenantId } });
  await tx.printFailure.deleteMany({ where: { tenantId } });
  await tx.productionOrderItem.deleteMany({ where: { tenantId } });
  await tx.productionOrder.deleteMany({ where: { tenantId } });
  await tx.purchaseOrderItem.deleteMany({ where: { tenantId } });
  await tx.purchaseOrder.deleteMany({ where: { tenantId } });
  await tx.materialBatch.deleteMany({ where: { tenantId } });
  await tx.inventoryTransaction.deleteMany({ where: { tenantId } });
  await tx.inventoryItem.deleteMany({ where: { tenantId } });
  await tx.stockAlertRule.deleteMany({ where: { tenantId } });
  await tx.printerPartTransaction.deleteMany({ where: { tenantId } });
  await tx.printerPart.updateMany({ where: { tenantId }, data: { quantity: 0, unitCost: 0 } });
  await tx.printerMaintenanceRecord.deleteMany({ where: { tenantId } });
  await tx.costRecord.deleteMany({ where: { tenantId } });
  await tx.expense.deleteMany({ where: { tenantId } });
  await tx.expenseCategory.deleteMany({ where: { tenantId } });
  await tx.profitSnapshot.deleteMany({ where: { tenantId } });
  await tx.dailyProfitReport.deleteMany({ where: { tenantId } });
  await tx.monthlyProfitReport.deleteMany({ where: { tenantId } });
  await tx.packagingItem.updateMany({ where: { tenantId }, data: { quantity: 0, unitPrice: 0 } });
  await tx.printer.updateMany({
    where: { tenantId },
    data: { lastMaintenanceAt: null, nextMaintenanceAt: null, lastMaintenanceHours: 0, status: "IDLE" }
  });
}

export async function resetTenantData(tx: TransactionClient, tenantId: string, scope: "OPERATIONS" | "ALL") {
  await clearOperationalData(tx, tenantId);
  if (scope === "ALL") {
    await tx.competitorAlert.deleteMany({ where: { tenantId } });
    await tx.competitorSnapshot.deleteMany({ where: { tenantId } });
    await tx.productCompetitor.deleteMany({ where: { tenantId } });
    await tx.productTitleVersion.deleteMany({ where: { tenantId } });
    await tx.productContentAsset.deleteMany({ where: { tenantId } });
    await tx.productDetailVersion.deleteMany({ where: { tenantId } });
    await tx.productAiGenerationJob.deleteMany({ where: { tenantId } });
    await tx.productModel.deleteMany({ where: { tenantId } });
    await tx.productOpportunity.deleteMany({ where: { tenantId } });
    await tx.productBomItem.deleteMany({ where: { tenantId } });
    await tx.productBom.deleteMany({ where: { tenantId } });
    await tx.productSku.deleteMany({ where: { tenantId } });
    await tx.product.deleteMany({ where: { tenantId } });
    await tx.material.deleteMany({ where: { tenantId } });
    await tx.packagingItem.deleteMany({ where: { tenantId } });
    await tx.printer.deleteMany({ where: { tenantId } });
    await tx.printerPart.deleteMany({ where: { tenantId } });
    await tx.toolAsset.deleteMany({ where: { tenantId } });
    await tx.supplier.deleteMany({ where: { tenantId } });
    await tx.shop.deleteMany({ where: { tenantId } });
    await tx.salesChannel.deleteMany({ where: { tenantId } });
  }
  await tx.auditLog.deleteMany({ where: { tenantId } });
}
