import { ChannelType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateOrderProfit } from "@/lib/profit";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const orderNo = text(form, "orderNo");
  const duplicate = await db.salesOrder.findFirst({ where: { tenantId: auth.session.tenantId, orderNo, deletedAt: null }, select: { id: true } });
  if (duplicate) return NextResponse.redirect(new URL("/app/orders/new?error=duplicate", process.env.APP_URL ?? request.url), 303);
  const skuId = text(form, "skuId");
  const shopId = text(form, "shopId") || null;
  const sku = await db.productSku.findFirstOrThrow({ where: { id: skuId, tenantId: auth.session.tenantId, deletedAt: null } });
  if (shopId) await db.shop.findFirstOrThrow({ where: { id: shopId, tenantId: auth.session.tenantId, deletedAt: null } });
  const quantity = Math.max(1, Number.parseInt(text(form, "quantity"), 10) || 1);
  const unitPrice = new Prisma.Decimal(decimalText(form, "unitPrice", sku.salePrice.toString()));
  const saleAmount = unitPrice.mul(quantity);
  const productCost = new Prisma.Decimal(decimalText(form, "productCost"));
  const values = {
    receivedAmount: decimalText(form, "receivedAmount", saleAmount.toString()),
    productCost,
    shippingCost: decimalText(form, "shippingCost"),
    packagingCost: decimalText(form, "packagingCost"),
    platformFee: decimalText(form, "platformFee"),
    paymentFee: decimalText(form, "paymentFee"),
    afterSaleCost: "0",
    adCost: decimalText(form, "adCost")
  };
  const profit = calculateOrderProfit(values);

  await db.$transaction(async (tx) => {
    const order = await tx.salesOrder.create({
      data: {
        tenantId: auth.session!.tenantId,
        shopId,
        orderNo,
        channel: ChannelType.MANUAL,
        customerName: text(form, "customerName") || null,
        customerRegion: text(form, "customerRegion") || null,
        itemSaleAmount: saleAmount,
        receivedAmount: values.receivedAmount,
        productCost,
        shippingCost: values.shippingCost,
        packagingCost: values.packagingCost,
        platformFee: values.platformFee,
        paymentFee: values.paymentFee,
        adCost: values.adCost,
        grossProfit: profit.grossProfit,
        netProfit: profit.netProfit,
        createdBy: auth.session!.userId,
        items: { create: [{ tenantId: auth.session!.tenantId, skuId: sku.id, skuName: sku.name, quantity, unitPrice, saleAmount, productCost }] }
      }
    });
    const initialCosts = [
      ["product", productCost, "初始产品成本"],
      ["shipping", values.shippingCost, "初始运费"],
      ["packaging", values.packagingCost, "初始包装成本"],
      ["platform", values.platformFee, "初始平台费用"],
      ["payment", values.paymentFee, "初始支付费用"],
      ["advertising", values.adCost, "初始广告费用"]
    ] as const;
    await tx.costRecord.createMany({
      data: initialCosts
        .map(([component, amount, remark]) => ({
          tenantId: auth.session!.tenantId,
          sourceType: "OrderInitialCost",
          sourceId: `${order.id}:${component}`,
          salesOrderId: order.id,
          skuId: component === "product" ? sku.id : null,
          amount: new Prisma.Decimal(amount),
          remark,
          createdBy: auth.session!.userId
        }))
        .filter(item => item.amount.gt(0))
    });
    await tx.auditLog.create({ data: { tenantId: auth.session!.tenantId, userId: auth.session!.userId, action: "order.created", entityType: "SalesOrder", entityId: order.id, metadata: { netProfit: profit.netProfit.toString() } } });
  });
  return NextResponse.redirect(new URL("/app/orders", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("orders.post", handlePost);
