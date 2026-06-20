import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function oneYearAgo() {
  const value = new Date();
  value.setFullYear(value.getFullYear() - 1);
  value.setHours(0, 0, 0, 0);
  return value;
}

export default async function ShopProfitPage() {
  const session = await requireSession();
  const from = oneYearAgo();
  const orders = await db.salesOrder.findMany({
    where: { tenantId: session.tenantId, orderedAt: { gte: from }, deletedAt: null },
    select: {
      shopId: true,
      receivedAmount: true,
      productCost: true,
      shippingCost: true,
      packagingCost: true,
      platformFee: true,
      paymentFee: true,
      adCost: true,
      afterSaleCost: true,
      netProfit: true,
      shop: { select: { name: true } }
    },
    take: 20000
  });
  const rows = new Map<string, { name: string; orders: number; sales: Prisma.Decimal; costs: Prisma.Decimal; afterSale: Prisma.Decimal; net: Prisma.Decimal }>();
  for (const order of orders) {
    const key = order.shopId ?? "unassigned";
    const current = rows.get(key) ?? { name: order.shop?.name ?? "未分配店铺", orders: 0, sales: new Prisma.Decimal(0), costs: new Prisma.Decimal(0), afterSale: new Prisma.Decimal(0), net: new Prisma.Decimal(0) };
    current.orders++;
    current.sales = current.sales.plus(order.receivedAmount);
    current.costs = current.costs.plus(order.productCost).plus(order.shippingCost).plus(order.packagingCost).plus(order.platformFee).plus(order.paymentFee).plus(order.adCost);
    current.afterSale = current.afterSale.plus(order.afterSaleCost);
    current.net = current.net.plus(order.netProfit);
    rows.set(key, current);
  }
  return <main>
    <PageHeader title="店铺利润排行" description="默认统计最近 12 个月，汇总不同店铺的销售额、成本、售后损失和净利润。" />
    <DataTable headers={["店铺", "订单数", "销售额", "经营成本", "售后成本", "净利润", "净利率"]} rows={[...rows.values()].sort((a, b) => b.net.minus(a.net).toNumber()).map(item => [
      item.name, item.orders, item.sales.toFixed(2), item.costs.toFixed(2), item.afterSale.toFixed(2), item.net.toFixed(2), `${item.sales.gt(0) ? item.net.div(item.sales).mul(100).toFixed(2) : "0.00"}%`
    ])} />
  </main>;
}
