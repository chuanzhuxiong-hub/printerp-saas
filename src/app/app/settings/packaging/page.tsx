import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PackagingPage() {
  const session = await requireSession();
  const items = await db.packagingItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  return <main><PageHeader title="包装材料管理" description={`当前共 ${items.length} 种包装材料。`} actionHref="/app/settings/packaging/new" />
    <DataTable headers={["名称", "规格", "单位", "单价", "库存", "警戒线", "操作"]} rows={items.map(item => [item.name, item.spec ?? "-", item.unit, item.unitPrice.toString(), item.quantity.toString(), item.warningStock.toString(), <Link className="font-semibold text-brand" href={`/app/settings/packaging/${item.id}/edit`}>编辑</Link>])} />
  </main>;
}
