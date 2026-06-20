import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function MaterialsPage() {
  const session = await requireSession();
  const items = await db.material.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  return <main><PageHeader title="耗材管理" description={`当前共 ${items.length} 种耗材。`} actionHref="/app/settings/materials/new" />
    <DataTable headers={["耗材名称", "材质", "颜色", "品牌", "单位", "库存警戒线", "操作"]} rows={items.map(item => [item.name, item.type, item.color ?? "-", item.brand ?? "-", item.unit, item.warningStock.toString(), <Link className="font-semibold text-brand" href={`/app/settings/materials/${item.id}/edit`}>编辑</Link>])} />
  </main>;
}
