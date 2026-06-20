import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "待生产",
    PRINTING: "打印中",
    QC_PENDING: "待质检",
    STOCKED: "已完成",
    SHIPPING_PENDING: "待发货",
    FAILED: "打印失败",
    REWORK: "返工",
    SCRAPPED: "报废"
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (["STOCKED", "SHIPPING_PENDING"].includes(status)) return "success";
  if (status === "PRINTING") return "info";
  if (["PENDING", "QC_PENDING", "REWORK"].includes(status)) return "warning";
  if (["FAILED", "SCRAPPED"].includes(status)) return "danger";
  return "neutral";
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return `¥${new Prisma.Decimal(value ?? 0).toFixed(2)}`;
}

function decimalText(value: Prisma.Decimal | number | string | null | undefined, digits = 2) {
  return new Prisma.Decimal(value ?? 0).toFixed(digits);
}

function dateText(value: Date | null | undefined) {
  return value ? value.toLocaleString("zh-CN") : "未记录";
}

export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const production = await db.productionOrder.findFirst({
    where: { id, tenantId: session.tenantId, deletedAt: null },
    include: { printer: true, items: { include: { sku: true } }, failures: true }
  });

  if (!production) notFound();

  const [transactions, costs, audits] = await Promise.all([
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId, sourceType: "ProductionOrder", sourceId: production.id }, orderBy: { createdAt: "desc" } }),
    db.costRecord.findMany({ where: { tenantId: session.tenantId, productionOrderId: production.id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { tenantId: session.tenantId, entityId: production.id }, orderBy: { createdAt: "desc" } })
  ]);

  const failureCost = production.failures.reduce((total, item) => total.plus(item.costLoss), new Prisma.Decimal(0));
  const canComplete = ["PENDING", "PRINTING", "QC_PENDING"].includes(production.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="生产工作台"
        title={`生产任务 ${production.orderNo}`}
        description="生产概览、SKU 明细、打印失败、库存流水、成本追溯和操作日志集中在一个页面，便于核对实际耗材、实际打印时间和完工入库结果。"
      >
        <Link href="/app/production" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">返回生产中心</Link>
        {canComplete && <Link href={`/app/production/${production.id}/complete`} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">完工入库</Link>}
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="计划数量" value={production.plannedQuantity} description="本次任务计划生产" tone="brand" />
        <MetricCard title="完成数量" value={production.completedQuantity} description="已完成可入库数量" tone="success" />
        <MetricCard title="失败数量" value={production.failedQuantity} description={`失败成本 ${money(failureCost)}`} tone={production.failedQuantity > 0 ? "danger" : "success"} />
        <MetricCard title="实际耗材" value={`${decimalText(production.actualMaterialGrams, 1)} g`} description="生产实际消耗克重" />
        <MetricCard title="实际打印时间" value={`${decimalText(production.actualPrintHours, 2)} h`} description="用于人工、折旧、电费核算" />
        <MetricCard title="实际成本" value={money(production.actualCost)} description="生产任务成本合计" tone={production.actualCost.gt(0) ? "warning" : "default"} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">生产概览</h2>
            <p className="mt-1 text-sm text-slate-500">核对生产状态、打印机、负责人、开始时间和结束时间。</p>
          </div>
          <StatusBadge tone={statusTone(production.status)}>{statusLabel(production.status)}</StatusBadge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">打印机</p><p className="mt-1 font-semibold text-ink">{production.printer?.name ?? "未分配打印机"}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">负责人</p><p className="mt-1 font-semibold text-ink">{production.assigneeName ?? "未分配"}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">开始时间</p><p className="mt-1 font-semibold text-ink">{dateText(production.startedAt)}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">结束时间</p><p className="mt-1 font-semibold text-ink">{dateText(production.endedAt)}</p></div>
        </div>
        {(production.failureReason || production.remark) && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {production.failureReason && <p><span className="font-semibold">异常原因：</span>{production.failureReason}</p>}
            {production.remark && <p className="mt-1"><span className="font-semibold">备注：</span>{production.remark}</p>}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">SKU 明细</h2>
        <DataTable
          headers={["SKU", "计划", "完成", "失败", "完成率"]}
          rows={production.items.map((item) => {
            const rate = item.plannedQuantity > 0 ? Math.round((item.completedQuantity / item.plannedQuantity) * 100) : 0;
            return [
              <div key={`${item.id}-sku`}><p className="font-semibold text-ink">{item.sku.name}</p><p className="mt-1 text-xs text-slate-500">{item.sku.skuCode}</p></div>,
              String(item.plannedQuantity),
              String(item.completedQuantity),
              String(item.failedQuantity),
              `${rate}%`
            ];
          })}
          emptyText="暂无 SKU 明细"
          emptyDescription="生产任务需要绑定 SKU 才能追溯成品库存和订单利润。"
          alignRightColumns={[1, 2, 3, 4]}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">打印失败</h2>
          <StatusBadge tone={failureCost.gt(0) ? "danger" : "success"}>失败成本 {money(failureCost)}</StatusBadge>
        </div>
        <DataTable
          headers={["原因", "数量", "损耗克数", "失败成本", "备注", "记录时间"]}
          rows={production.failures.map((item) => [
            item.reason,
            String(item.quantity),
            `${decimalText(item.materialLossGrams, 1)} g`,
            money(item.costLoss),
            item.remark ?? "-",
            item.createdAt.toLocaleString("zh-CN")
          ])}
          emptyText="暂无打印失败记录"
          emptyDescription="如果出现断料、翘边、模型错误等情况，应记录失败数量、耗材损耗和失败成本。"
          alignRightColumns={[1, 2, 3]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">库存流水</h2>
        <DataTable
          headers={["类型", "类别", "数量", "单位成本", "总成本", "来源", "时间"]}
          rows={transactions.map((item) => [
            item.type,
            item.category,
            decimalText(item.quantity, 3),
            money(item.unitCost),
            money(item.totalCost),
            item.sourceType ?? "-",
            item.createdAt.toLocaleString("zh-CN")
          ])}
          emptyText="暂无库存流水"
          emptyDescription="完工入库、生产消耗和报废都应通过库存流水追踪。"
          alignRightColumns={[2, 3, 4]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">成本追溯</h2>
          <DataTable
            headers={["来源", "金额", "说明", "时间"]}
            rows={costs.map((item) => [
              item.sourceType,
              money(item.amount),
              item.remark ?? "-",
              item.createdAt.toLocaleString("zh-CN")
            ])}
            emptyText="暂无成本记录"
            emptyDescription="生产耗材、失败、折旧、电费等成本记录会影响订单利润追溯。"
            alignRightColumns={[1]}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">操作日志</h2>
          <DataTable
            headers={["动作", "对象", "操作人", "时间"]}
            rows={audits.map((item) => [
              item.action,
              item.entityType,
              item.userId ?? "系统",
              item.createdAt.toLocaleString("zh-CN")
            ])}
            emptyText="暂无操作日志"
            emptyDescription="关键生产动作会记录日志，便于追溯责任和排查成本差异。"
          />
        </div>
      </section>
    </div>
  );
}

