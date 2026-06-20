import { InventoryCategory, InventoryTransactionType, Prisma, PurchaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/business-date";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { getPurchaseSafety } from "@/lib/purchase-safety";
import { convertToGrams } from "@/lib/weight";

async function handlePost(request: Request, logContext: RequestLogContext, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const { id } = await params;
  const form = await request.formData();
  const action = text(form, "action");

  try {
    await db.$transaction(async tx => {
      const { purchase, item, inventory, batch, creationAudit } = await getPurchaseSafety(tx, session.tenantId, id);
      const oldValue = inventory.quantity.mul(inventory.unitCost);
      const metadata = creationAudit?.metadata && typeof creationAudit.metadata === "object" && !Array.isArray(creationAudit.metadata) ? creationAudit.metadata as Prisma.JsonObject : null;
      const beforeQuantity = metadata?.beforeQuantity !== undefined ? new Prisma.Decimal(String(metadata.beforeQuantity)) : null;
      const beforeUnitCost = metadata?.beforeUnitCost !== undefined ? new Prisma.Decimal(String(metadata.beforeUnitCost)) : null;

      if (action === "cancel") {
        const nextQuantity = beforeQuantity ?? inventory.quantity.minus(item.quantity);
        const nextValue = oldValue.minus(purchase.totalCost);
        const nextUnitCost = beforeUnitCost ?? (nextQuantity.gt(0) ? Prisma.Decimal.max(nextValue, 0).div(nextQuantity) : new Prisma.Decimal(0));
        await tx.inventoryItem.update({ where: { id: inventory.id }, data: { quantity: nextQuantity, unitCost: nextUnitCost, updatedBy: session.userId } });
        if (item.category === InventoryCategory.PACKAGING && item.packagingItemId) {
          await tx.packagingItem.update({ where: { id: item.packagingItemId }, data: { quantity: nextQuantity, unitPrice: nextUnitCost, updatedBy: session.userId } });
        }
        if (batch) await tx.materialBatch.update({ where: { id: batch.id }, data: { deletedAt: new Date(), updatedBy: session.userId } });
        await tx.purchaseOrder.update({ where: { id: purchase.id }, data: { status: PurchaseStatus.CANCELLED, updatedBy: session.userId } });
        await tx.inventoryTransaction.create({
          data: {
            tenantId: session.tenantId, itemId: inventory.id, category: item.category, refId: inventory.refId,
            type: InventoryTransactionType.MANUAL_ADJUST, quantity: item.quantity.negated(), unitCost: purchase.totalCost.div(item.quantity),
            totalCost: purchase.totalCost.negated(), sourceType: "PurchaseCancellation", sourceId: purchase.id,
            remark: `撤销采购单 ${purchase.orderNo}`, createdBy: session.userId
          }
        });
        await tx.auditLog.create({
          data: { tenantId: session.tenantId, userId: session.userId, action: "purchase.cancelled", entityType: "PurchaseOrder", entityId: purchase.id, metadata: { quantity: item.quantity.toString(), totalCost: purchase.totalCost.toString() } }
        });
        return;
      }

      const supplierId = text(form, "supplierId") || null;
      if (supplierId) await tx.supplier.findFirstOrThrow({ where: { id: supplierId, tenantId: session.tenantId, deletedAt: null } });
      const purchaseDate = parseDateInput(text(form, "purchaseDate"));
      const purchaseAmount = new Prisma.Decimal(decimalText(form, "purchaseAmount"));
      const shippingFee = new Prisma.Decimal(decimalText(form, "shippingFee"));
      const taxFee = new Prisma.Decimal(decimalText(form, "taxFee"));
      const discountAmount = new Prisma.Decimal(decimalText(form, "discountAmount"));
      const totalCost = purchaseAmount.plus(shippingFee).plus(taxFee).minus(discountAmount);
      const quantity = item.category === InventoryCategory.MATERIAL
        ? convertToGrams(text(form, "purchaseWeight"), text(form, "weightUnit") || "KG")
        : new Prisma.Decimal(decimalText(form, "quantity"));
      if (quantity.lte(0) || totalCost.lt(0)) throw new Error("采购数量必须大于 0，入库总成本不能小于 0");

      const nextQuantity = beforeQuantity?.plus(quantity) ?? inventory.quantity.minus(item.quantity).plus(quantity);
      if (nextQuantity.lt(0)) throw new Error("修改后的库存数量无效");
      const nextValue = beforeQuantity && beforeUnitCost ? beforeQuantity.mul(beforeUnitCost).plus(totalCost) : oldValue.minus(purchase.totalCost).plus(totalCost);
      const nextUnitCost = nextQuantity.gt(0) ? Prisma.Decimal.max(nextValue, 0).div(nextQuantity) : new Prisma.Decimal(0);
      await tx.purchaseOrder.update({
        where: { id: purchase.id },
        data: { supplierId, orderNo: text(form, "orderNo"), purchaseDate, purchaseAmount, shippingFee, taxFee, discountAmount, totalCost, updatedBy: session.userId }
      });
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { quantity, amount: purchaseAmount, unitCost: totalCost.div(quantity) } });
      await tx.inventoryItem.update({ where: { id: inventory.id }, data: { quantity: nextQuantity, unitCost: nextUnitCost, updatedBy: session.userId } });
      if (item.category === InventoryCategory.PACKAGING && item.packagingItemId) {
        await tx.packagingItem.update({ where: { id: item.packagingItemId }, data: { quantity: nextQuantity, unitPrice: nextUnitCost, updatedBy: session.userId } });
      }
      if (batch) {
        await tx.materialBatch.update({
          where: { id: batch.id },
          data: {
            supplierId, batchNo: text(form, "batchNo"), purchasedAt: purchaseDate, purchaseGrams: quantity, remainingGrams: quantity,
            purchaseAmount, shippingFee, taxFee, discountAmount, totalCost, costPerGram: totalCost.div(quantity), updatedBy: session.userId
          }
        });
      }
      const quantityDelta = quantity.minus(item.quantity);
      const costDelta = totalCost.minus(purchase.totalCost);
      if (!quantityDelta.eq(0) || !costDelta.eq(0)) {
        await tx.inventoryTransaction.create({
          data: {
            tenantId: session.tenantId, itemId: inventory.id, category: item.category, refId: inventory.refId,
            type: InventoryTransactionType.MANUAL_ADJUST, quantity: quantityDelta,
            unitCost: quantityDelta.eq(0) ? nextUnitCost : costDelta.div(quantityDelta),
            totalCost: costDelta, sourceType: "PurchaseCorrection", sourceId: purchase.id,
            createdAt: purchaseDate, remark: `采购单更正：${purchase.orderNo}`, createdBy: session.userId
          }
        });
      }
      await tx.auditLog.create({
        data: { tenantId: session.tenantId, userId: session.userId, action: "purchase.updated", entityType: "PurchaseOrder", entityId: purchase.id, metadata: { oldQuantity: item.quantity.toString(), newQuantity: quantity.toString(), oldTotalCost: purchase.totalCost.toString(), newTotalCost: totalCost.toString() } }
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "采购单操作失败";
    return NextResponse.redirect(new URL(`/app/purchases/${id}?error=${encodeURIComponent(message)}`, process.env.APP_URL ?? request.url), 303);
  }

  return NextResponse.redirect(new URL(action === "cancel" ? "/app/purchases" : `/app/purchases/${id}`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("purchases.by-id.post", handlePost);
