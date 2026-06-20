import { AfterSaleType, InventoryCategory, InventoryTransactionType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { decreaseInventory } from "@/lib/inventory";
import { calculateOrderProfit } from "@/lib/profit";

const resendTypes: AfterSaleType[] = ["RESEND_PRODUCT", "WRONG_ITEM", "MISSING_ITEM", "DAMAGED", "QUALITY_ISSUE"];

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const salesOrderId = text(form, "salesOrderId");
  const type = text(form, "type") as AfterSaleType;
  const resendSkuId = text(form, "resendSkuId") || null;
  const resendQuantity = Math.max(0, Number.parseInt(text(form, "resendQuantity"), 10) || 0);
  const inputCosts = {
    refundAmount: new Prisma.Decimal(decimalText(form, "refundAmount")),
    resendShippingCost: new Prisma.Decimal(decimalText(form, "resendShippingCost")),
    returnShippingCost: new Prisma.Decimal(decimalText(form, "returnShippingCost")),
    scrapCost: new Prisma.Decimal(decimalText(form, "scrapCost")),
    platformPenalty: new Prisma.Decimal(decimalText(form, "platformPenalty")),
    laborCost: new Prisma.Decimal(decimalText(form, "laborCost"))
  };

  await db.$transaction(async tx => {
    const order = await tx.salesOrder.findFirstOrThrow({
      where: { id: salesOrderId, tenantId: session.tenantId, deletedAt: null },
      include: { items: { include: { sku: { include: { bom: { include: { items: true } } } } } } }
    });
    if (resendTypes.includes(type) && (!resendSkuId || resendQuantity <= 0)) {
      throw new Error("补发类售后必须选择订单内 SKU 和补发数量");
    }

    let resendProductCost = new Prisma.Decimal(0);
    let resendPackagingCost = new Prisma.Decimal(0);
    const inventoryChanges: Array<{ inventoryId: string; quantity: Prisma.Decimal }> = [];

    if (resendSkuId && resendQuantity > 0) {
      const orderItem = order.items.find(item => item.skuId === resendSkuId);
      if (!orderItem?.sku) throw new Error("补发 SKU 不属于该销售订单");
      const productQuantity = new Prisma.Decimal(resendQuantity);
      const productInventory = await tx.inventoryItem.findUniqueOrThrow({
        where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PRODUCT, refId: resendSkuId } }
      });
      inventoryChanges.push({ inventoryId: productInventory.id, quantity: productQuantity });
      resendProductCost = productQuantity.mul(productInventory.unitCost);

      for (const bomItem of orderItem.sku.bom?.items ?? []) {
        if (bomItem.category !== InventoryCategory.PACKAGING) continue;
        const quantity = bomItem.quantity.mul(resendQuantity);
        const inventory = await tx.inventoryItem.findUniqueOrThrow({
          where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PACKAGING, refId: bomItem.refId } }
        });
        inventoryChanges.push({ inventoryId: inventory.id, quantity });
        resendPackagingCost = resendPackagingCost.plus(quantity.mul(inventory.unitCost));
      }
    }

    const totalCost = Object.values(inputCosts).reduce(
      (sum, value) => sum.plus(value),
      resendProductCost.plus(resendPackagingCost)
    );
    const afterSale = await tx.afterSale.create({
      data: {
        tenantId: session.tenantId,
        salesOrderId,
        type,
        reason: text(form, "reason") || null,
        ...inputCosts,
        resendProductCost,
        resendPackagingCost,
        totalCost,
        remark: text(form, "remark") || null,
        createdBy: session.userId,
        items: resendSkuId && resendQuantity > 0
          ? { create: [{ tenantId: session.tenantId, skuId: resendSkuId, quantity: resendQuantity, cost: resendProductCost }] }
          : undefined
      }
    });

    for (const change of inventoryChanges) {
      await decreaseInventory(tx, {
        tenantId: session.tenantId,
        itemId: change.inventoryId,
        quantity: change.quantity,
        type: InventoryTransactionType.AFTERSALE_RESEND_OUT,
        sourceType: "AfterSale",
        sourceId: afterSale.id,
        remark: `售后补发 ${order.orderNo}`,
        userId: session.userId
      });
    }

    const aggregate = await tx.afterSale.aggregate({
      where: { tenantId: session.tenantId, salesOrderId, deletedAt: null },
      _sum: { totalCost: true }
    });
    const afterSaleCost = aggregate._sum.totalCost ?? new Prisma.Decimal(0);
    const profit = calculateOrderProfit({ ...order, afterSaleCost });
    await tx.salesOrder.update({
      where: { id: order.id },
      data: { afterSaleCost, afterSaleStatus: "处理中", status: "AFTERSALE", ...profit }
    });
    await tx.costRecord.create({
      data: {
        tenantId: session.tenantId,
        sourceType: "AfterSale",
        sourceId: afterSale.id,
        salesOrderId,
        skuId: resendSkuId,
        amount: totalCost,
        remark: afterSale.reason,
        createdBy: session.userId
      }
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "after_sale.created",
        entityType: "AfterSale",
        entityId: afterSale.id,
        metadata: { totalCost: totalCost.toString(), resendSkuId, resendQuantity, inventoryChanges: inventoryChanges.length }
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return NextResponse.redirect(new URL(`/app/orders/${salesOrderId}`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("after-sales.create", handlePost);
