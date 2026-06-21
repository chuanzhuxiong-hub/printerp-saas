import { Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { requireSession } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { getOnboardingStatus } from "@/lib/onboarding";

function money(value: string | number | Prisma.Decimal) {
  return `¥${new Prisma.Decimal(value).toFixed(2)}`;
}

function percentOf(value: Prisma.Decimal, max: Prisma.Decimal) {
  if (max.lte(0)) return 0;
  return Math.min(100, Math.max(4, value.div(max).mul(100).toNumber()));
}

function printerStatusLabel(status: string) {
  const labels: Record<string, string> = {
    IDLE: "空闲",
    PRINTING: "打印中",
    MAINTENANCE: "维护中",
    DISABLED: "已停用"
  };
  return labels[status] ?? status;
}

function printerStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "PRINTING") return "info";
  if (status === "IDLE") return "success";
  if (status === "MAINTENANCE") return "warning";
  if (status === "DISABLED") return "danger";
  return "neutral";
}

export default async function DashboardPage() {
  const session = await requireSession();
  const [data, onboarding] = await Promise.all([
    getDashboard(session.tenantId),
    getOnboardingStatus(session.tenantId)
  ]);

  const from = new Date();
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);

  const [recentOrders, lowStockItems, printerGroups, productionGroups] = await Promise.all([
    db.salesOrder.findMany({
      where: { tenantId: session.tenantId, orderedAt: { gte: from }, deletedAt: null },
      include: { shop: true, items: true }
    }),
    db.inventoryItem.findMany({
      where: { tenantId: session.tenantId, deletedAt: null, quantity: { lte: db.inventoryItem.fields.warningStock } },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    db.printer.groupBy({
      by: ["status"],
      where: { tenantId: session.tenantId, deletedAt: null },
      _count: true
    }),
    db.productionOrder.groupBy({
      by: ["status"],
      where: { tenantId: session.tenantId, deletedAt: null },
      _count: true
    })
  ]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    const orders = recentOrders.filter((item) => item.orderedAt >= date && item.orderedAt < next);
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      sales: orders.reduce((sum, item) => sum.plus(item.receivedAmount), new Prisma.Decimal(0)),
      net: orders.reduce((sum, item) => sum.plus(item.netProfit), new Prisma.Decimal(0)),
      orders: orders.length
    };
  });

  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const salesTrend = yesterday.sales.gt(0) ? today.sales.minus(yesterday.sales).div(yesterday.sales).mul(100).toNumber() : 0;
  const maxSales = days.reduce((max, day) => Prisma.Decimal.max(max, day.sales), new Prisma.Decimal(1));

  const shops = new Map<string, Prisma.Decimal>();
  const skus = new Map<string, Prisma.Decimal>();
  for (const order of recentOrders) {
    const shop = order.shop?.name ?? "未分配店铺";
    shops.set(shop, (shops.get(shop) ?? new Prisma.Decimal(0)).plus(order.netProfit));
    for (const item of order.items) {
      const share = order.itemSaleAmount.gt(0) ? item.saleAmount.div(order.itemSaleAmount) : new Prisma.Decimal(0);
      skus.set(item.skuName, (skus.get(item.skuName) ?? new Prisma.Decimal(0)).plus(order.netProfit.mul(share)));
    }
  }

  const productionMap = new Map(productionGroups.map((item) => [item.status, item._count]));
  const printerTotal = printerGroups.reduce((sum, item) => sum + item._count, 0);
  const printerRows = printerGroups.map((item) => [
    <StatusBadge key={item.status} tone={printerStatusTone(item.status)}>{printerStatusLabel(item.status)}</StatusBadge>,
    item._count,
    printerTotal ? `${Math.round((item._count / printerTotal) * 100)}%` : "0%"
  ]);

  const todoItems = [
    { label: "待生产", value: data.pendingProduction, href: "/app/production", tone: data.pendingProduction > 0 ? "warning" : "success" },
    { label: "待发货", value: data.pendingShipping, href: "/app/orders", tone: data.pendingShipping > 0 ? "warning" : "success" },
    { label: "库存预警", value: data.lowStock, href: "/app/inventory", tone: data.lowStock > 0 ? "danger" : "success" },
    { label: "竞品异常", value: data.competitorAlerts, href: "/app/products?tab=competitors", tone: data.competitorAlerts > 0 ? "warning" : "success" }
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business Cockpit"
        title="经营驾驶舱"
        description="集中查看今日销售额、今日净利润、订单履约、库存预警、售后成本和打印机状态，帮助 3D 打印商家快速判断当天经营情况。"
      >
        <Link href="/app/orders/import" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          导入订单
        </Link>
        <Link href="/app/help/getting-started" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          继续初始化
        </Link>
      </PageHeader>

      {!onboarding.isComplete && (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">开始使用 PrintERP</h2>
              <p className="mt-1 text-sm text-slate-600">完成基础资料配置后，系统才能准确计算订单利润、库存和生产成本。</p>
            </div>
            <Link href="/app/help/getting-started" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              继续初始化
            </Link>
          </div>
          <OnboardingProgress data={onboarding} compact />
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="今日销售额" value={money(data.sales)} description="已付款/已成交订单实收" trend={<TrendIndicator value={salesTrend} label="较昨日" />} tone="brand" />
        <MetricCard title="今日净利润" value={money(data.netProfit)} description={`毛利 ${money(data.grossProfit)}`} tone={new Prisma.Decimal(data.netProfit).gte(0) ? "success" : "danger"} />
        <MetricCard title="今日订单数" value={data.orders} description={`今日发货 ${data.shippedCount} 单`} />
        <MetricCard title="待生产" value={data.pendingProduction} description={`生产中 ${productionMap.get("PRINTING") ?? 0} 个任务`} tone={data.pendingProduction > 0 ? "warning" : "success"} />
        <MetricCard title="待发货" value={data.pendingShipping} description="订单已生产或等待物流" tone={data.pendingShipping > 0 ? "warning" : "success"} />
        <MetricCard title="库存预警" value={data.lowStock} description="低于警戒线的库存项" tone={data.lowStock > 0 ? "danger" : "success"} />
        <MetricCard title="售后成本" value={money(data.afterSaleCost)} description="退款、补发、破损等损失" tone={new Prisma.Decimal(data.afterSaleCost).gt(0) ? "warning" : "success"} />
        <MetricCard title="打印失败" value={data.failedCount} description={`今日生产 ${data.productionCount} 件`} tone={data.failedCount > 0 ? "danger" : "success"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">利润趋势</h2>
              <p className="mt-1 text-sm text-slate-500">近 7 天销售额与净利润变化</p>
            </div>
            <StatusBadge tone="info">近 7 天</StatusBadge>
          </div>
          <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
            {days.map((day) => (
              <div key={day.label} className="grid grid-cols-[44px_1fr] gap-x-3 gap-y-2 rounded-xl bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[48px_1fr_110px_90px] sm:items-center sm:bg-transparent sm:px-0 sm:py-0">
                <span className="text-slate-500">{day.label}</span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${percentOf(day.sales, maxSales)}%` }} />
                </div>
                <span className="text-right text-xs tabular-nums text-slate-600 sm:text-sm">销售 {money(day.sales)}</span>
                <span className="text-right text-xs font-semibold tabular-nums text-ink sm:text-sm">净利 {money(day.net)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">经营待办</h2>
          <p className="mt-1 text-sm text-slate-500">优先处理影响利润、履约和库存安全的事项。</p>
          <div className="mt-5 space-y-3">
            {todoItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/50">
                <div>
                  <p className="font-semibold text-ink">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">点击进入处理页面</p>
                </div>
                <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">SKU 利润排行</h2>
          <p className="mt-1 text-sm text-slate-500">按近 7 天订单净利润分摊估算。</p>
          <div className="mt-4 space-y-3">
            {[...skus].sort((a, b) => b[1].minus(a[1]).toNumber()).slice(0, 5).map(([name, value], index) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="min-w-0 truncate"><span className="mr-2 text-slate-400">#{index + 1}</span>{name}</span>
                <span className="font-semibold tabular-nums text-ink">{money(value)}</span>
              </div>
            ))}
            {!skus.size && <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">暂无 SKU 利润数据</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">店铺利润排行</h2>
          <p className="mt-1 text-sm text-slate-500">对比不同店铺近期净利润贡献。</p>
          <div className="mt-4 space-y-3">
            {[...shops].sort((a, b) => b[1].minus(a[1]).toNumber()).slice(0, 5).map(([name, value], index) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="min-w-0 truncate"><span className="mr-2 text-slate-400">#{index + 1}</span>{name}</span>
                <span className="font-semibold tabular-nums text-ink">{money(value)}</span>
              </div>
            ))}
            {!shops.size && <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">暂无店铺利润数据</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">库存预警</h2>
              <p className="mt-1 text-sm text-slate-500">低库存会影响生产排期和订单履约。</p>
            </div>
            <Link href="/app/inventory" className="text-sm font-semibold text-brand hover:text-blue-700">查看库存</Link>
          </div>
          <DataTable
            headers={["库存项", "类型", "当前库存", "警戒线"]}
            rows={lowStockItems.map((item) => [
              item.name,
              <StatusBadge key={item.id} tone="warning">{item.category}</StatusBadge>,
              item.quantity.toFixed(3),
              item.warningStock.toFixed(3)
            ])}
            emptyText="暂无库存预警"
            emptyDescription="当前没有低于警戒线的耗材、成品或包装库存。"
            alignRightColumns={[2, 3]}
          />
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">打印机状态</h2>
              <p className="mt-1 text-sm text-slate-500">快速判断产能是否紧张或需要维护。</p>
            </div>
            <Link href="/app/settings/printers" className="text-sm font-semibold text-brand hover:text-blue-700">管理打印机</Link>
          </div>
          <DataTable
            headers={["状态", "数量", "占比"]}
            rows={printerRows}
            emptyText="暂无打印机"
            emptyDescription="添加打印机后，这里会显示空闲、打印中、维护中和停用数量。"
            emptyActionHref="/app/settings/printers/new"
            emptyActionLabel="添加打印机"
            alignRightColumns={[1, 2]}
          />
        </div>
      </section>
    </div>
  );
}
