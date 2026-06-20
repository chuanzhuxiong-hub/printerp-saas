import { InventoryCategory, InventoryTransactionType, Prisma, PurchaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { convertToGrams } from "@/lib/weight";
import { parseDateInput, todayInputValue } from "@/lib/business-date";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const materialId = text(form, "materialId");
  const material = await db.material.findFirstOrThrow({
    where: { id: materialId, tenantId: session.tenantId, deletedAt: null }
  });
  const supplierId = text(form, "supplierId") || null;
  if (supplierId) {
    await db.supplier.findFirstOrThrow({ where: { id: supplierId, tenantId: session.tenantId, deletedAt: null } });
  }

  const purchaseWeight = text(form, "purchaseWeight");
  const weightUnit = purchaseWeight ? text(form, "weightUnit") || "KG" : "G";
  let grams: Prisma.Decimal;
  try {
    grams = convertToGrams(purchaseWeight || decimalText(form, "purchaseGrams"), weightUnit);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "入库重量无效" }, { status: 400 });
  }
  const purchaseAmount = new Prisma.Decimal(decimalText(form, "purchaseAmount"));
  const shippingFee = new Prisma.Decimal(decimalText(form, "shippingFee"));
  const taxFee = new Prisma.Decimal(decimalText(form, "taxFee"));
  const discountAmount = new Prisma.Decimal(decimalText(form, "discountAmount"));
  const totalCost = purchaseAmount.plus(shippingFee).plus(taxFee).minus(discountAmount);
  const costPerGram = totalCost.div(grams);
  const orderNo = text(form, "orderNo");
  const batchNo = text(form, "batchNo");
  let purchaseDate: Date;
  try {
    purchaseDate = parseDateInput(text(form, "purchaseDate") || todayInputValue());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "采购日期无效" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    const purchase = await tx.purchaseOrder.create({
      data: {
        tenantId: session.tenantId,
        supplierId,
        orderNo,
        status: PurchaseStatus.RECEIVED,
        purchaseDate,
        purchaseAmount,
        shippingFee,
        taxFee,
        discountAmount,
        totalCost,
        createdBy: session.userId,
        items: {
          create: [{
            tenantId: session.tenantId,
            category: InventoryCategory.MATERIAL,
            materialId,
            quantity: grams,
            amount: purchaseAmount,
            unitCost: costPerGram
          }]
        }
      }
    });

    const batch = await tx.materialBatch.create({
      data: {
        tenantId: session.tenantId,
        materialId,
        supplierId,
        batchNo,
        purchasedAt: purchaseDate,
        purchaseGrams: grams,
        purchaseAmount,
        shippingFee,
        taxFee,
        discountAmount,
        totalCost,
        costPerGram,
        remainingGrams: grams,
        createdBy: session.userId
      }
    });

    const existing = await tx.inventoryItem.findUnique({
      where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.MATERIAL, refId: materialId } }
    });
    const oldQuantity = existing?.quantity ?? new Prisma.Decimal(0);
    const oldValue = oldQuantity.mul(existing?.unitCost ?? 0);
    const newQuantity = oldQuantity.plus(grams);
    const movingAverageCost = oldValue.plus(totalCost).div(newQuantity);

    const inventory = await tx.inventoryItem.upsert({
      where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.MATERIAL, refId: materialId } },
      create: {
        tenantId: session.tenantId,
        category: InventoryCategory.MATERIAL,
        refId: materialId,
        name: material.name,
        quantity: grams,
        warningStock: material.warningStock,
        unitCost: movingAverageCost,
        createdBy: session.userId
      },
      update: { quantity: newQuantity, unitCost: movingAverageCost, updatedBy: session.userId }
    });

    const transaction = await tx.inventoryTransaction.create({
      data: {
        tenantId: session.tenantId,
        itemId: inventory.id,
        category: InventoryCategory.MATERIAL,
        refId: materialId,
        type: InventoryTransactionType.PURCHASE_IN,
        quantity: grams,
        unitCost: costPerGram,
        totalCost,
        sourceType: "PurchaseOrder",
        sourceId: purchase.id,
        createdAt: purchaseDate,
        createdBy: session.userId
      }
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "purchase.received",
        entityType: "PurchaseOrder",
        entityId: purchase.id,
        metadata: {
          batchId: batch.id,
          inventoryTransactionId: transaction.id,
          inputWeight: purchaseWeight || grams.toString(),
          inputWeightUnit: weightUnit,
          convertedGrams: grams.toString(),
          purchaseDate: purchaseDate.toISOString().slice(0, 10),
          beforeQuantity: oldQuantity.toString(),
          beforeUnitCost: (existing?.unitCost ?? new Prisma.Decimal(0)).toString(),
          movingAverageCost: movingAverageCost.toString()
        }
      }
    });
  });

  return NextResponse.redirect(new URL("/app/purchases", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("purchases.create", handlePost);
