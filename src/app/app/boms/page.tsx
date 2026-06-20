import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function BomsPage() {
  const session = await requireSession();
  const boms = await db.productBom.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    include: { sku: true, defaultMaterial: true, items: true },
    orderBy: { createdAt: "desc" }
  });
  return <main>
    <PageHeader title="产品 BOM / 打印配方" description={`当前共 ${boms.length} 套生产配方，理论成本基于保存时的当前成本计算。`} actionHref="/app/boms/new" actionLabel="新增 BOM" />
    <div className="mt-4"><Link href="/app/gcode" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-muted">G-code 解析更新</Link></div>
    <DataTable headers={["SKU", "默认耗材", "理论克数", "损耗克数", "打印小时", "包装成本", "理论产品成本", "操作"]} rows={boms.map(item => [
      `${item.sku.skuCode} · ${item.sku.name}`, item.defaultMaterial?.name ?? "-", item.theoreticalGrams.toString(), item.wasteGrams.toString(),
      item.estimatedPrintHours.toString(), item.items.reduce((sum, row) => sum.plus(row.totalCost), new Prisma.Decimal(0)).toString(), item.estimatedProductCost.toString(),
      <Link className="font-semibold text-brand" href={`/app/boms/${item.id}/edit`}>编辑并重算</Link>
    ])} />
  </main>;
}
