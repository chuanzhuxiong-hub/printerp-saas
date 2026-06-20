import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function SuppliersPage() {
  const session = await requireSession();
  const items = await db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  return <main><PageHeader title="供应商管理" description={`当前共 ${items.length} 个供应商。`} actionHref="/app/settings/suppliers/new" />
    <DataTable headers={["供应商名称", "联系人", "电话", "状态", "备注", "操作"]} rows={items.map(item => [item.name, item.contact ?? "-", item.phone ?? "-", item.isActive ? "启用" : "停用", item.remark ?? "-", <div className="flex gap-3"><Link className="font-semibold text-brand" href={`/app/settings/suppliers/${item.id}/edit`}>编辑</Link><form action={`/api/suppliers/${item.id}`} method="post"><input type="hidden" name="intent" value="toggle" /><button className="font-semibold text-muted">{item.isActive ? "停用" : "启用"}</button></form></div>])} />
  </main>;
}
