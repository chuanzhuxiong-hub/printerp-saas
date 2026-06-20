import { Prisma, ProductionStatus } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageCount, parsePagination } from "@/lib/pagination";

type ProductionTab = "ALL" | "PENDING" | "PRINTING" | "QC_PENDING" | "STOCKED" | "FAILED";

const tabs: Array<{ key: ProductionTab; label: string; description: string }> = [
  { key: "ALL", label: "全部", description: "全部生产任务" },
  { key: "PENDING", label: "待生产", description: "等待排机或领取" },
  { key: "PRINTING", label: "打印中", description: "正在生产跟进" },
  { key: "QC_PENDING", label: "待质检", description: "等待检查入库" },
  { key: "STOCKED", label: "已完成", description: "已完工入库" },
  { key: "FAILED", label: "打印失败", description: "失败或异常任务" }
];

const boardColumns: Array<{ key: ProductionStatus; label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = [
  { key: "PENDING", label: "待生产", tone: "warning" },
  { key: "PRINTING", label: "打印中", tone: "info" },
  { key: "QC_PENDING", label: "待质检", tone: "warning" },
  { key: "STOCKED", label: "已完成", tone: "success" },
  { key: "FAILED", label: "打印失败", tone: "danger" }
];

function activeTab(value?: string): ProductionTab {
  return tabs.some((tab) => tab.key === value) ? value as ProductionTab : "ALL";
}

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
  if (["PRINTING"].includes(status)) return "info";
  if (["PENDING", "QC_PENDING", "REWORK"].includes(status)) return "warning";
  if (["FAILED", "SCRAPPED"].includes(status)) return "danger";
  return "neutral";
}

function printerStatusLabel(status: string) {
  const labels: Record<string, string> = {
    IDLE: "空闲",
    PRINTING: "打印中",
    MAINTENANCE: "维护中",
    DISABLED: "停用"
  };
  return labels[status] ?? status;
}

function printerStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "IDLE") return "success";
  if (status === "PRINTING") return "info";
  if (status === "MAINTENANCE") return "warning";
  if (status === "DISABLED") return "danger";
  return "neutral";
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return `¥${new Prisma.Decimal(value ?? 0).toFixed(2)}`;
}

function decimalText(value: Prisma.Decimal | number | string | null | undefined, digits = 2) {
  return new Prisma.Decimal(value ?? 0).toFixed(digits);
}

export default async function ProductionPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; keyword?: string; printerId?: string; page?: string; pageSize?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const tab = activeTab(query.tab);
  const keyword = query.keyword?.trim();
  const pagination = parsePagination(query, { pageSize: 30, maxPageSize: 100 });

  const baseWhere: Prisma.ProductionOrderWhereInput = {
    tenantId: session.tenantId,
    deletedAt: null,
    printerId: query.printerId && query.printerId !== "ALL" ? query.printerId : undefined,
    OR: keyword ? [
      { orderNo: { contains: keyword, mode: "insensitive" } },
      { assigneeName: { contains: keyword, mode: "insensitive" } },
      { printer: { name: { contains: keyword, mode: "insensitive" } } },
      { items: { some: { sku: { name: { contains: keyword, mode: "insensitive" } } } } },
      { items: { some: { sku: { skuCode: { contains: keyword, mode: "insensitive" } } } } }
    ] : undefined
  };

  const where: Prisma.ProductionOrderWhereInput = tab === "ALL" ? baseWhere : { ...baseWhere, status: tab as ProductionStatus };

  const [orders, total, sum, printers, tabCounts, boardOrders, failureCount] = await Promise.all([
    db.productionOrder.findMany({
      where,
      include: { printer: true, items: { include: { sku: true } }, failures: true },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take
    }),
    db.productionOrder.count({ where }),
    db.productionOrder.aggregate({
      where,
      _sum: { plannedQuantity: true, completedQuantity: true, failedQuantity: true, actualMaterialGrams: true, actualPrintHours: true, actualCost: true },
      _count: true
    }),
    db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    Promise.all(tabs.map(async (item) => {
      const countWhere = item.key === "ALL" ? baseWhere : { ...baseWhere, status: item.key as ProductionStatus };
      return [item.key, await db.productionOrder.count({ where: countWhere })] as const;
    })),
    db.productionOrder.findMany({
      where: { tenantId: session.tenantId, deletedAt: null, status: { in: boardColumns.map((column) => column.key) } },
      include: { printer: true, items: { include: { sku: true }, take: 2 } },
      orderBy: { createdAt: "desc" },
      take: 80
    }),
    db.printFailure.count({ where: { tenantId: session.tenantId } })
  ]);

  const countMap = new Map(tabCounts);
  const totalPages = pageCount(total, pagination.pageSize);
  const makeHref = (next: Partial<{ tab: string; page: number; keyword: string; printerId: string }>) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    if (next.keyword ?? keyword) params.set("keyword", next.keyword ?? keyword ?? "");
    if (next.printerId ?? query.printerId) params.set("printerId", next.printerId ?? query.printerId ?? "ALL");
    params.set("page", String(next.page ?? pagination.page));
    params.set("pageSize", String(pagination.pageSize));
    return `/app/production?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="3D 打印生产后台"
        title="生产中心"
        description="用生产看板、表格视图和打印机状态统一跟进待生产、打印中、待质检、已完成和打印失败任务。完工入库仍走原有生产流程，确保库存流水和成本追溯不丢。"
        actionHref="/app/production/new"
        actionLabel="新建生产任务"
      >
        <Link href="/app/settings/printers" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">管理打印机</Link>
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="生产任务" value={sum._count} description="当前筛选条件" tone="brand" />
        <MetricCard title="待生产" value={countMap.get("PENDING") ?? 0} description="等待排机" tone="warning" />
        <MetricCard title="打印中" value={countMap.get("PRINTING") ?? 0} description="正在生产" tone="brand" />
        <MetricCard title="打印失败" value={countMap.get("FAILED") ?? 0} description={`累计失败记录 ${failureCount}`} tone={(countMap.get("FAILED") ?? 0) > 0 ? "danger" : "success"} />
        <MetricCard title="实际耗材" value={`${decimalText(sum._sum.actualMaterialGrams, 1)} g`} description={`打印时长 ${decimalText(sum._sum.actualPrintHours, 2)} h`} />
        <MetricCard title="实际成本" value={money(sum._sum.actualCost)} description="耗材、失败、折旧等" tone={(sum._sum.actualCost ?? new Prisma.Decimal(0)).gt(0) ? "warning" : "default"} />
      </section>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tabs.map((item) => (
          <Link key={item.key} href={makeHref({ tab: item.key, page: 1 })} className={`rounded-2xl border p-4 shadow-sm transition ${tab === item.key ? "border-blue-200 bg-blue-50 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{item.label}</p>
              <StatusBadge tone={tab === item.key ? "info" : "neutral"}>{countMap.get(item.key) ?? 0}</StatusBadge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
          </Link>
        ))}
      </div>

      <FilterBar>
        <form action="/app/production" method="get" className="flex w-full flex-wrap items-center gap-3">
          <input type="hidden" name="tab" value={tab} />
          <input name="keyword" defaultValue={keyword} placeholder="搜索生产单、负责人、打印机、SKU" className="min-w-[280px] flex-1 rounded-lg border px-3 py-2 text-sm" />
          <select name="printerId" defaultValue={query.printerId ?? "ALL"} className="rounded-lg border px-3 py-2 text-sm">
            <option value="ALL">全部打印机</option>
            {printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">筛选</button>
          <Link href="/app/production" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">重置</Link>
        </form>
      </FilterBar>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">生产看板</h2>
            <p className="mt-1 text-sm text-slate-500">按状态快速查看任务流转，适合日常排机和异常处理。</p>
          </div>
          <StatusBadge tone="info">看板视图</StatusBadge>
        </div>
        <div className="grid gap-4 xl:grid-cols-5">
          {boardColumns.map((column) => {
            const columnOrders = boardOrders.filter((order) => order.status === column.key).slice(0, 8);
            return (
              <div key={column.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-ink">{column.label}</h3>
                  <StatusBadge tone={column.tone}>{columnOrders.length}</StatusBadge>
                </div>
                <div className="space-y-3">
                  {columnOrders.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-400">暂无任务</p>}
                  {columnOrders.map((order) => (
                    <Link key={order.id} href={`/app/production/${order.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-brand">{order.orderNo}</p>
                        <StatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{order.items.map((item) => item.sku.name).join("、") || "未绑定 SKU"}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                        <span>计划 {order.plannedQuantity}</span>
                        <span>完成 {order.completedQuantity}</span>
                        <span>失败 {order.failedQuantity}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{order.printer?.name ?? "未分配打印机"}</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">打印机状态</h2>
            <p className="mt-1 text-sm text-slate-500">查看打印机空闲、打印中、维护中和停用状态，辅助安排生产任务。</p>
          </div>
          <Link href="/app/settings/printers" className="text-sm font-semibold text-brand">维护打印机</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {printers.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 md:col-span-2 xl:col-span-4">还没有添加打印机。先在系统设置里维护打印机，生产任务才能准确统计设备效率。</p>}
          {printers.map((printer) => (
            <div key={printer.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{printer.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{printer.model ?? printer.code}</p>
                </div>
                <StatusBadge tone={printerStatusTone(printer.status)}>{printerStatusLabel(printer.status)}</StatusBadge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div><p className="text-xs text-slate-400">可用小时</p><p className="font-semibold text-ink">{decimalText(printer.availableHours, 1)} h</p></div>
                <div><p className="text-xs text-slate-400">折旧/小时</p><p className="font-semibold text-ink">{money(printer.depreciationPerHour)}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">表格视图</h2>
          <p className="mt-1 text-sm text-slate-500">用于批量核对生产任务、实际耗材、实际成本和完工入库入口。</p>
        </div>
        <DataTable
          headers={["生产任务", "SKU", "打印机", "计划", "完成", "失败", "实际耗材", "实际成本", "状态", "操作"]}
          rows={orders.map((order) => [
            <div key={`${order.id}-order`}>
              <Link href={`/app/production/${order.id}`} className="font-semibold text-brand">{order.orderNo}</Link>
              <p className="mt-1 text-xs text-slate-500">负责人：{order.assigneeName ?? "未分配"}</p>
            </div>,
            <div key={`${order.id}-sku`} className="space-y-1">{order.items.map((item) => <p key={item.id} className="text-sm text-slate-700">{item.sku.skuCode} · {item.sku.name}</p>)}</div>,
            order.printer?.name ?? "未分配",
            String(order.plannedQuantity),
            String(order.completedQuantity),
            String(order.failedQuantity),
            `${decimalText(order.actualMaterialGrams, 1)} g`,
            money(order.actualCost),
            <StatusBadge key={`${order.id}-status`} tone={statusTone(order.status)}>{statusLabel(order.status)}</StatusBadge>,
            <div key={`${order.id}-actions`} className="flex justify-end gap-3">
              <Link href={`/app/production/${order.id}`} className="font-semibold text-brand">详情</Link>
              {["PENDING", "PRINTING", "QC_PENDING"].includes(order.status) ? <Link href={`/app/production/${order.id}/complete`} className="font-semibold text-brand">完工入库</Link> : <span className="text-slate-400">已处理</span>}
            </div>
          ])}
          emptyText="暂无生产任务"
          emptyDescription="可以从订单详情创建生产任务，也可以手工新增备货生产任务。"
          emptyActionHref="/app/production/new"
          emptyActionLabel="新建生产任务"
          alignRightColumns={[3, 4, 5, 6, 7, 9]}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        <span>第 {pagination.page} / {totalPages} 页，每页 {pagination.pageSize} 条，本页 {orders.length} 条</span>
        <div className="flex gap-2">
          <Link href={makeHref({ page: Math.max(pagination.page - 1, 1) })} className={`rounded-lg border px-3 py-2 font-semibold ${pagination.page <= 1 ? "pointer-events-none opacity-50" : "bg-white text-brand"}`}>上一页</Link>
          <Link href={makeHref({ page: Math.min(pagination.page + 1, totalPages) })} className={`rounded-lg border px-3 py-2 font-semibold ${pagination.page >= totalPages ? "pointer-events-none opacity-50" : "bg-white text-brand"}`}>下一页</Link>
        </div>
      </div>
    </div>
  );
}
