import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CostImportsPage({
  searchParams
}: {
  searchParams: Promise<{ type?: string; matched?: string; unmatched?: string; invalid?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const records = await db.costRecord.findMany({
    where: { tenantId: session.tenantId, sourceType: { in: ["ShippingBillImport", "AdvertisingCostImport"] } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return <main>
    <PageHeader title="费用账单导入" description="按订单号匹配快递账单或广告费用，更新成本后自动重算订单利润。" />
    {query.matched !== undefined && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      {query.type === "ADVERTISING" ? "广告费用" : "快递账单"}导入完成：匹配 {query.matched} 个订单，未匹配 {query.unmatched ?? "0"} 个订单，无效 {query.invalid ?? "0"} 行。
    </p>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <ImportCard type="SHIPPING" title="导入快递账单" description="同一订单多行运费会汇总，并更新订单当前快递成本。" />
      <ImportCard type="ADVERTISING" title="导入广告费用" description="同一订单多行广告消耗会汇总，并更新订单当前广告成本。" />
    </div>
    <div className="mt-6 rounded-lg bg-panel p-4 text-sm text-muted">
      必需字段：订单号、金额。可选字段：运单号/账单号/广告计划ID、快递公司/广告平台、备注。支持 CSV、XLSX。
    </div>
    <h2 className="mt-8 text-lg font-semibold">最近导入成本</h2>
    <DataTable headers={["类型", "订单 ID", "金额", "说明", "更新时间"]} rows={records.map(item => [
      item.sourceType === "ShippingBillImport" ? "快递账单" : "广告费用",
      item.salesOrderId ?? "-",
      item.amount.toString(),
      item.remark ?? "-",
      item.createdAt.toLocaleString("zh-CN")
    ])} />
  </main>;
}

function ImportCard({ type, title, description }: { type: string; title: string; description: string }) {
  return <form action="/api/cost-imports" method="post" encType="multipart/form-data" className="space-y-4 rounded-xl border bg-white p-6 shadow-soft">
    <input type="hidden" name="type" value={type} />
    <div>
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
    <input name="file" type="file" accept=".csv,.xlsx" required className="block w-full rounded-lg border px-3 py-2.5 text-sm" />
    <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">开始导入</button>
  </form>;
}
