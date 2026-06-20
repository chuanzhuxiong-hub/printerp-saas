import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SkuTrendsPage() {
  const session = await requireSession();
  const from = new Date();
  from.setMonth(from.getMonth() - 5, 1);
  from.setHours(0, 0, 0, 0);
  const items = await db.salesOrderItem.findMany({
    where: { tenantId: session.tenantId, salesOrder: { orderedAt: { gte: from }, deletedAt: null } },
    include: { sku: true, salesOrder: true }
  });
  const rows = new Map<string, { month: string; sku: string; quantity: number; sales: Prisma.Decimal; net: Prisma.Decimal }>();
  for (const item of items) {
    const month = item.salesOrder.orderedAt.toISOString().slice(0, 7);
    const sku = item.sku?.skuCode ?? item.skuName;
    const key = `${month}:${sku}`;
    const row = rows.get(key) ?? { month, sku, quantity: 0, sales: new Prisma.Decimal(0), net: new Prisma.Decimal(0) };
    const share = item.salesOrder.itemSaleAmount.gt(0) ? item.saleAmount.div(item.salesOrder.itemSaleAmount) : new Prisma.Decimal(0);
    row.quantity += item.quantity;
    row.sales = row.sales.plus(item.saleAmount);
    row.net = row.net.plus(item.salesOrder.netProfit.mul(share));
    rows.set(key, row);
  }
  return <main>
    <PageHeader title="SKU 利润趋势" description="按月查看最近六个月 SKU 销量、销售额和分摊净利润变化。" />
    <DataTable headers={["月份", "SKU", "销量", "销售额", "分摊净利", "净利率"]} rows={[...rows.values()].sort((a, b) => b.month.localeCompare(a.month) || b.net.minus(a.net).toNumber()).map(row => [
      row.month, row.sku, row.quantity, row.sales.toFixed(2), row.net.toFixed(2), `${row.sales.gt(0) ? row.net.div(row.sales).mul(100).toFixed(2) : "0.00"}%`
    ])} />
  </main>;
}
