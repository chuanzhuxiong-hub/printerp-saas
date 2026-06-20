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

export default async function SkuProfitPage() {
  const session = await requireSession();
  const from = oneYearAgo();
  const items = await db.salesOrderItem.findMany({
    where: { tenantId: session.tenantId, salesOrder: { tenantId: session.tenantId, orderedAt: { gte: from }, deletedAt: null } },
    select: {
      skuId: true,
      skuName: true,
      quantity: true,
      saleAmount: true,
      productCost: true,
      sku: { select: { skuCode: true } },
      salesOrder: { select: { itemSaleAmount: true, netProfit: true, afterSaleCost: true } }
    },
    take: 20000
  });
  const rows = new Map<string, { name: string; quantity: number; sales: Prisma.Decimal; cost: Prisma.Decimal; net: Prisma.Decimal; afterSales: number }>();
  for (const item of items) {
    const key = item.skuId ?? item.skuName;
    const current = rows.get(key) ?? { name: item.sku?.skuCode ? `${item.sku.skuCode} · ${item.skuName}` : item.skuName, quantity: 0, sales: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), net: new Prisma.Decimal(0), afterSales: 0 };
    const share = item.salesOrder.itemSaleAmount.gt(0) ? item.saleAmount.div(item.salesOrder.itemSaleAmount) : new Prisma.Decimal(0);
    current.quantity += item.quantity;
    current.sales = current.sales.plus(item.saleAmount);
    current.cost = current.cost.plus(item.productCost);
    current.net = current.net.plus(item.salesOrder.netProfit.mul(share));
    if (item.salesOrder.afterSaleCost.gt(0)) current.afterSales++;
    rows.set(key, current);
  }
  return <main>
    <PageHeader title="SKU 利润排行" description="默认统计最近 12 个月，按订单销售金额比例分摊订单净利，识别高利润与亏损 SKU。" />
    <DataTable headers={["SKU", "销量", "销售额", "产品成本", "分摊净利", "净利率", "售后订单数"]} rows={[...rows.values()].sort((a, b) => b.net.minus(a.net).toNumber()).slice(0, 500).map(item => [
      item.name, item.quantity, item.sales.toFixed(2), item.cost.toFixed(2), item.net.toFixed(2), `${item.sales.gt(0) ? item.net.div(item.sales).mul(100).toFixed(2) : "0.00"}%`, item.afterSales
    ])} />
  </main>;
}
