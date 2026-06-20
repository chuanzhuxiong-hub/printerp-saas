import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PrintersPage() {
  const session = await requireSession();
  const items = await db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { code: "asc" } });
  return <main><PageHeader title="打印机管理" description={`当前共 ${items.length} 台打印机。`} actionHref="/app/settings/printers/new" />
    <div className="mt-4"><Link href="/app/printer-maintenance" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-muted">维护提醒与记录</Link></div>
    <DataTable headers={["编号", "名称", "型号", "购买价格", "每小时折旧", "状态", "操作"]} rows={items.map(item => [item.code, item.name, item.model ?? "-", item.purchasePrice.toString(), item.depreciationPerHour.toString(), item.status, <Link className="font-semibold text-brand" href={`/app/settings/printers/${item.id}/edit`}>编辑</Link>])} />
  </main>;
}
