import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export function calculateOrderProfit(input: {
  receivedAmount: Prisma.Decimal.Value;
  productCost: Prisma.Decimal.Value;
  shippingCost: Prisma.Decimal.Value;
  packagingCost: Prisma.Decimal.Value;
  platformFee: Prisma.Decimal.Value;
  paymentFee: Prisma.Decimal.Value;
  afterSaleCost: Prisma.Decimal.Value;
  adCost: Prisma.Decimal.Value;
}) {
  const received = new Prisma.Decimal(input.receivedAmount);
  const grossProfit = received
    .minus(input.productCost)
    .minus(input.shippingCost)
    .minus(input.packagingCost)
    .minus(input.platformFee)
    .minus(input.paymentFee);
  const netProfit = grossProfit.minus(input.afterSaleCost).minus(input.adCost);
  return { grossProfit, netProfit };
}

export async function recalculateOrderProfit(tenantId: string, orderId: string) {
  const order = await db.salesOrder.findFirstOrThrow({
    where: { id: orderId, tenantId, deletedAt: null }
  });
  const profit = calculateOrderProfit(order);
  return db.salesOrder.update({
    where: { id: order.id },
    data: profit
  });
}
