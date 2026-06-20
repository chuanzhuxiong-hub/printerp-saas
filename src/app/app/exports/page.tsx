import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";

const exports = [
  ["销售订单", "orders", "订单金额、成本、利润和状态"],
  ["库存主表", "inventory", "库存数量、警戒线与单位成本"],
  ["经营费用", "expenses", "费用日期、名称与金额"],
  ["审计日志", "audit", "最近最多 10000 条关键操作记录"]
];

export default async function ExportsPage() {
  await requireSession();
  return <main>
    <PageHeader title="数据导出" description="导出当前商家空间的数据，用于财务归档、分析和备份核验。" />
    <div className="mt-6 grid gap-4 md:grid-cols-2">{exports.map(([label, resource, description]) => <section key={resource} className="rounded-xl border bg-white p-5 shadow-soft">
      <h2 className="font-semibold">{label}</h2><p className="mt-1 text-sm text-muted">{description}</p>
      <Link href={`/api/exports?resource=${resource}`} className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">下载 CSV</Link>
    </section>)}</div>
  </main>;
}
