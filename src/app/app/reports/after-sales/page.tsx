import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AfterSalesReportPage() {
  const session = await requireSession();
  const records = await db.afterSale.findMany({ where: { tenantId: session.tenantId, deletedAt: null } });
  const total = records.reduce((sum, item) => sum.plus(item.totalCost), new Prisma.Decimal(0));
  const rows = new Map<string, { count: number; cost: Prisma.Decimal }>();
  for (const record of records) {
    const current = rows.get(record.type) ?? { count: 0, cost: new Prisma.Decimal(0) };
    current.count++;
    current.cost = current.cost.plus(record.totalCost);
    rows.set(record.type, current);
  }
  return <main>
    <PageHeader title="售后损失报表" description={`累计售后损失 ${total.toFixed(2)}，按售后类型汇总。`} />
    <DataTable headers={["售后类型", "次数", "损失成本", "成本占比"]} rows={[...rows].sort((a, b) => b[1].cost.minus(a[1].cost).toNumber()).map(([type, item]) => [
      type, item.count, item.cost.toFixed(2), `${total.gt(0) ? item.cost.div(total).mul(100).toFixed(2) : "0.00"}%`
    ])} />
  </main>;
}
