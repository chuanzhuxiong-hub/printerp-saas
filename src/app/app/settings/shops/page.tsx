import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ShopsPage() {
  const session = await requireSession();
  const shops = await db.shop.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, include: { salesChannel: true }, orderBy: { name: "asc" } });
  return <main><PageHeader title="店铺管理" description={`当前共 ${shops.length} 个店铺。`} actionHref="/app/settings/shops/new" />
    <DataTable headers={["店铺名称", "销售渠道", "联系人", "状态", "备注", "操作"]} rows={shops.map(item => [item.name, item.salesChannel?.name ?? "手工订单", item.contactName ?? "-", item.isActive ? "启用" : "停用", item.remark ?? "-", <div className="flex gap-3"><Link className="font-semibold text-brand" href={`/app/settings/shops/${item.id}/edit`}>编辑</Link><form action={`/api/shops/${item.id}`} method="post"><input type="hidden" name="intent" value="toggle" /><button className="font-semibold text-muted">{item.isActive ? "停用" : "启用"}</button></form></div>])} />
  </main>;
}
