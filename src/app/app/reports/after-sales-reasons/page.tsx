import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AfterSalesReasonsPage() {
  const session = await requireSession();
  const records = await db.afterSale.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    include: { salesOrder: { include: { items: { include: { sku: true } } } } }
  });
  const total = records.reduce((sum, item) => sum.plus(item.totalCost), new Prisma.Decimal(0));
  const rows = new Map<string, { reason: string; type: string; count: number; cost: Prisma.Decimal; skus: Set<string> }>();
  for (const record of records) {
    const reason = record.reason || "未填写原因";
    const key = `${record.type}:${reason}`;
    const row = rows.get(key) ?? { reason, type: record.type, count: 0, cost: new Prisma.Decimal(0), skus: new Set<string>() };
    row.count++;
    row.cost = row.cost.plus(record.totalCost);
    for (const item of record.salesOrder.items) row.skus.add(item.sku?.skuCode ?? item.skuName);
    rows.set(key, row);
  }
  return <main>
    <PageHeader title="售后原因分析" description="按售后类型和具体原因定位损失，并关联受影响 SKU。" />
    <DataTable headers={["类型", "原因", "次数", "损失成本", "成本占比", "关联 SKU"]} rows={[...rows.values()].sort((a, b) => b.cost.minus(a.cost).toNumber()).map(row => [
      row.type, row.reason, row.count, row.cost.toFixed(2), `${total.gt(0) ? row.cost.div(total).mul(100).toFixed(2) : "0.00"}%`, [...row.skus].slice(0, 5).join("、") || "-"
    ])} />
  </main>;
}
