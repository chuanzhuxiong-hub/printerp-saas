import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SupplierCostsPage() {
  const session = await requireSession();
  const [batches, suppliers] = await Promise.all([
    db.materialBatch.findMany({ where: { tenantId: session.tenantId }, include: { material: true }, orderBy: { purchasedAt: "desc" } }),
    db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null } })
  ]);
  const supplierMap = new Map(suppliers.map(item => [item.id, item.name]));
  const grouped = new Map<string, { supplier: string; material: string; batches: number; grams: Prisma.Decimal; cost: Prisma.Decimal; latest: Prisma.Decimal }>();
  for (const batch of batches) {
    const supplier = batch.supplierId ? supplierMap.get(batch.supplierId) ?? "未知供应商" : "未指定供应商";
    const key = `${batch.materialId}:${batch.supplierId ?? "none"}`;
    const current = grouped.get(key) ?? { supplier, material: batch.material.name, batches: 0, grams: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), latest: batch.costPerGram };
    current.batches++;
    current.grams = current.grams.plus(batch.purchaseGrams);
    current.cost = current.cost.plus(batch.totalCost);
    grouped.set(key, current);
  }
  return <main>
    <PageHeader title="供应商成本对比" description="按耗材和供应商汇总采购批次，比较加权平均成本与最近采购成本。" />
    <DataTable headers={["耗材", "供应商", "批次数", "采购克数", "采购总成本", "加权平均/克", "最近成本/克"]} rows={[...grouped.values()].sort((a, b) => a.material.localeCompare(b.material) || a.cost.div(a.grams).minus(b.cost.div(b.grams)).toNumber()).map(row => [
      row.material, row.supplier, row.batches, row.grams.toFixed(3), row.cost.toFixed(2), row.grams.gt(0) ? row.cost.div(row.grams).toFixed(4) : "0", row.latest.toFixed(4)
    ])} />
  </main>;
}
