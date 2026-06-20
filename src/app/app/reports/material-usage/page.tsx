import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function MaterialUsagePage() {
  const session = await requireSession();
  const [materials, transactions] = await Promise.all([
    db.material.findMany({ where: { tenantId: session.tenantId, deletedAt: null } }),
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId, category: "MATERIAL", type: "PRODUCTION_CONSUME" } })
  ]);
  const rows = materials.map(material => {
    const used = transactions.filter(item => item.refId === material.id).reduce((sum, item) => sum.plus(item.quantity.abs()), new Prisma.Decimal(0));
    const cost = transactions.filter(item => item.refId === material.id).reduce((sum, item) => sum.plus(item.totalCost.abs()), new Prisma.Decimal(0));
    return { material, used, cost };
  }).filter(item => item.used.gt(0)).sort((a, b) => b.used.minus(a.used).toNumber());
  return <main>
    <PageHeader title="耗材使用报表" description="按耗材统计生产消耗克数与实际成本。" />
    <DataTable headers={["耗材", "材质", "颜色", "品牌", "使用克数", "消耗成本"]} rows={rows.map(item => [
      item.material.name, item.material.type, item.material.color ?? "-", item.material.brand ?? "-", item.used.toString(), item.cost.toFixed(2)
    ])} />
  </main>;
}
