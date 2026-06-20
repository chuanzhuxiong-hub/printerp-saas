import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateReplenishment } from "@/lib/inventory-analysis";

export default async function ReplenishmentPage() {
  const session = await requireSession();
  const from = new Date(Date.now() - 30 * 86400000);
  const [items, transactions] = await Promise.all([
    db.inventoryItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.inventoryTransaction.findMany({
      where: { tenantId: session.tenantId, createdAt: { gte: from }, quantity: { lt: 0 } },
      select: { itemId: true, quantity: true }
    })
  ]);
  const consumed = new Map<string, Prisma.Decimal>();
  for (const row of transactions) if (row.itemId) consumed.set(row.itemId, (consumed.get(row.itemId) ?? new Prisma.Decimal(0)).plus(row.quantity.abs()));
  const analysis = items.map(item => ({ item, ...calculateReplenishment({
    quantity: item.quantity, lockedQuantity: item.lockedQuantity, warningStock: item.warningStock, consumedLast30Days: consumed.get(item.id) ?? 0
  })})).sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.recommendedQuantity.minus(a.recommendedQuantity).toNumber());

  return <main>
    <PageHeader title="补货建议" description="基于最近 30 天真实出库速度、可用库存和警戒线计算建议补货量。" />
    <DataTable headers={["类型", "库存项", "可用库存", "30 天消耗", "日均消耗", "可支撑天数", "建议补货", "优先级"]} rows={analysis.map(row => [
      row.item.category, row.item.name, row.available.toFixed(3), (consumed.get(row.item.id) ?? new Prisma.Decimal(0)).toFixed(3),
      row.averageDaily.toFixed(3), row.coverageDays?.toFixed(1) ?? "无近期消耗", row.recommendedQuantity.toFixed(3),
      row.urgent ? <span className="font-semibold text-red-600">优先补货</span> : "正常"
    ])} />
  </main>;
}
