import { Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return `¥${new Prisma.Decimal(value ?? 0).toFixed(2)}`;
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "RECEIVED") return "success";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { DRAFT: "草稿", RECEIVED: "已入库", CANCELLED: "已撤销" };
  return labels[status] ?? status;
}

export default async function PurchasesPage() {
  const session = await requireSession();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [orders, batches, totals, monthTotals] = await Promise.all([
    db.purchaseOrder.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { purchaseDate: "desc" }, take: 100 }),
    db.materialBatch.count({ where: { tenantId: session.tenantId, deletedAt: null } }),
    db.purchaseOrder.aggregate({ where: { tenantId: session.tenantId, deletedAt: null }, _sum: { purchaseAmount: true, shippingFee: true, taxFee: true, discountAmount: true, totalCost: true }, _count: true }),
    db.purchaseOrder.aggregate({ where: { tenantId: session.tenantId, deletedAt: null, purchaseDate: { gte: monthStart } }, _sum: { purchaseAmount: true, totalCost: true }, _count: true })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="采购中心"
        title="采购管理"
        description="统一管理耗材采购入库、包装采购入库和耗材批次成本。采购日期用于报表统计，入库后形成批次成本和库存流水。"
        actionHref="/app/purchases/new"
        actionLabel="采购入库"
      >
        <Link href="/app/purchases/packaging/new" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">包装采购入库</Link>
        <Link href="/app/purchases/batches" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">耗材批次</Link>
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="采购单数" value={totals._count} description="全部有效采购单" tone="brand" />
        <MetricCard title="采购总金额" value={money(totals._sum.purchaseAmount)} description={`本月 ${money(monthTotals._sum.purchaseAmount)} · ${monthTotals._count} 单`} />
        <MetricCard title="入库总成本" value={money(totals._sum.totalCost)} description={`运费 ${money(totals._sum.shippingFee)} · 税费 ${money(totals._sum.taxFee)}`} tone="success" />
        <MetricCard title="耗材批次" value={batches} description={`优惠 ${money(totals._sum.discountAmount)}`} tone={batches > 0 ? "success" : "warning"} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/app/purchases/new" className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:bg-blue-100/60">
          <StatusBadge tone="info">耗材</StatusBadge>
          <h2 className="mt-3 text-lg font-semibold text-ink">耗材采购入库</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">录入重量单位、采购金额、运费、税费和优惠，自动换算每克成本。</p>
        </Link>
        <Link href="/app/purchases/packaging/new" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40">
          <StatusBadge tone="neutral">包装</StatusBadge>
          <h2 className="mt-3 text-lg font-semibold text-ink">包装采购入库</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">记录纸箱、气泡袋、胶带等包装材料采购和库存成本。</p>
        </Link>
        <Link href="/app/reports/purchases" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40">
          <StatusBadge tone="neutral">报表</StatusBadge>
          <h2 className="mt-3 text-lg font-semibold text-ink">采购金额分析</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">按天、周、月、年查看耗材、包装和打印机配件采购金额。</p>
        </Link>
      </section>

      <DataTable
        headers={["采购单号", "采购日期", "采购金额", "运费", "税费", "优惠", "入库总成本", "状态", "操作"]}
        rows={orders.map((order) => [
          <Link key={`${order.id}-no`} className="font-semibold text-brand" href={`/app/purchases/${order.id}`}>{order.orderNo}</Link>,
          order.purchaseDate.toLocaleDateString("zh-CN"),
          money(order.purchaseAmount),
          money(order.shippingFee),
          money(order.taxFee),
          money(order.discountAmount),
          money(order.totalCost),
          <StatusBadge key={`${order.id}-status`} tone={statusTone(order.status)}>{statusLabel(order.status)}</StatusBadge>,
          <div key={`${order.id}-actions`} className="flex justify-end gap-3"><Link className="font-semibold text-brand" href={`/app/purchases/${order.id}`}>详情</Link><Link className="font-semibold text-brand" href={`/app/purchases/${order.id}/edit`}>编辑</Link></div>
        ])}
        emptyText="暂无采购单"
        emptyDescription="先录入第一批耗材采购，系统才能计算每克成本和生产成本。"
        emptyActionHref="/app/purchases/new"
        emptyActionLabel="采购入库"
        alignRightColumns={[2, 3, 4, 5, 6, 8]}
      />
    </div>
  );
}
