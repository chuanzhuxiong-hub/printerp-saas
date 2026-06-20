import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function MaterialBatchesPage() {
  const session = await requireSession();
  const batches = await db.materialBatch.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, include: { material: true }, orderBy: { purchasedAt: "desc" }, take: 200 });
  return <main>
    <PageHeader title="耗材批次" description={`共 ${batches.length} 个耗材采购批次，可追踪每克成本与剩余克数。`} />
    <DataTable headers={["批次号", "耗材", "采购日期", "采购克数", "总成本", "每克成本", "剩余克数", "状态"]} rows={batches.map(item => [item.batchNo, item.material.name, item.purchasedAt.toLocaleDateString("zh-CN"), item.purchaseGrams.toString(), item.totalCost.toString(), item.costPerGram.toString(), item.remainingGrams.toString(), item.status])} />
  </main>;
}
