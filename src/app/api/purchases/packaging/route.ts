import { InventoryCategory, InventoryTransactionType, Prisma, PurchaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { parseDateInput, todayInputValue } from "@/lib/business-date";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const packagingItemId = text(form, "packagingItemId");
  const packaging = await db.packagingItem.findFirstOrThrow({ where: { id: packagingItemId, tenantId: session.tenantId, deletedAt: null } });
  const supplierId = text(form, "supplierId") || null;
  if (supplierId) await db.supplier.findFirstOrThrow({ where: { id: supplierId, tenantId: session.tenantId, deletedAt: null } });
  const quantity = new Prisma.Decimal(decimalText(form, "quantity"));
  const purchaseAmount = new Prisma.Decimal(decimalText(form, "purchaseAmount"));
  const shippingFee = new Prisma.Decimal(decimalText(form, "shippingFee"));
  const taxFee = new Prisma.Decimal(decimalText(form, "taxFee"));
  const discountAmount = new Prisma.Decimal(decimalText(form, "discountAmount"));
  const totalCost = purchaseAmount.plus(shippingFee).plus(taxFee).minus(discountAmount);
  const unitCost = totalCost.div(quantity);
  let purchaseDate: Date;
  try {
    purchaseDate = parseDateInput(text(form, "purchaseDate") || todayInputValue());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "采购日期无效" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    const purchase = await tx.purchaseOrder.create({
      data: {
        tenantId: session.tenantId, supplierId, orderNo: text(form, "orderNo"), status: PurchaseStatus.RECEIVED, purchaseDate,
        purchaseAmount, shippingFee, taxFee, discountAmount, totalCost, createdBy: session.userId,
        items: { create: [{ tenantId: session.tenantId, category: InventoryCategory.PACKAGING, packagingItemId, quantity, amount: purchaseAmount, unitCost }] }
      }
    });
    const existing = await tx.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PACKAGING, refId: packagingItemId } } });
    const oldQuantity = existing?.quantity ?? new Prisma.Decimal(0);
    const newQuantity = oldQuantity.plus(quantity);
    const movingAverageCost = oldQuantity.mul(existing?.unitCost ?? 0).plus(totalCost).div(newQuantity);
    const inventory = await tx.inventoryItem.upsert({
      where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PACKAGING, refId: packagingItemId } },
      create: { tenantId: session.tenantId, category: InventoryCategory.PACKAGING, refId: packaging.id, name: packaging.name, quantity, warningStock: packaging.warningStock, unitCost: movingAverageCost, createdBy: session.userId },
      update: { quantity: newQuantity, unitCost: movingAverageCost, updatedBy: session.userId }
    });
    await tx.packagingItem.update({ where: { id: packaging.id }, data: { quantity: newQuantity, unitPrice: movingAverageCost, updatedBy: session.userId } });
    const transaction = await tx.inventoryTransaction.create({
      data: { tenantId: session.tenantId, itemId: inventory.id, category: InventoryCategory.PACKAGING, refId: packaging.id, type: InventoryTransactionType.PURCHASE_IN, quantity, unitCost, totalCost, sourceType: "PurchaseOrder", sourceId: purchase.id, createdBy: session.userId, createdAt: purchaseDate }
    });
    await tx.auditLog.create({
      data: { tenantId: session.tenantId, userId: session.userId, action: "packaging_purchase.received", entityType: "PurchaseOrder", entityId: purchase.id, metadata: { inventoryTransactionId: transaction.id, beforeQuantity: oldQuantity.toString(), beforeUnitCost: (existing?.unitCost ?? new Prisma.Decimal(0)).toString(), movingAverageCost: movingAverageCost.toString(), purchaseDate: purchaseDate.toISOString().slice(0, 10) } }
    });
  });
  return NextResponse.redirect(new URL("/app/purchases", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("purchases.packaging.create", handlePost);
