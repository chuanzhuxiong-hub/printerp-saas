import { Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return `¥${new Prisma.Decimal(value ?? 0).toFixed(2)}`;
}

function percent(numerator: Prisma.Decimal, denominator: Prisma.Decimal) {
  return denominator.gt(0) ? `${numerator.div(denominator).mul(100).toFixed(2)}%` : "0.00%";
}

type ReportAggregate = NonNullable<Awaited<ReturnType<typeof db.salesOrder.aggregate>>>;
type ExpenseAggregate = NonNullable<Awaited<ReturnType<typeof db.expense.aggregate>>>;

type OrderSumKey = "receivedAmount" | "grossProfit" | "netProfit" | "productCost" | "shippingCost" | "packagingCost" | "platformFee" | "paymentFee" | "afterSaleCost" | "adCost";

function orderSum(report: ReportAggregate, key: OrderSumKey) {
  return report._sum?.[key] ?? new Prisma.Decimal(0);
}

function expenseSum(expense: ExpenseAggregate) {
  return expense._sum?.amount ?? new Prisma.Decimal(0);
}

function operatingProfit(report: ReportAggregate, expense: ExpenseAggregate, toolDepreciation: Prisma.Decimal) {
  return orderSum(report, "netProfit").minus(expenseSum(expense)).minus(toolDepreciation);
}

function periodCard(label: string, report: ReportAggregate, expense: ExpenseAggregate, toolDepreciation: Prisma.Decimal) {
  const net = orderSum(report, "netProfit");
  const sales = orderSum(report, "receivedAmount");
  const operating = operatingProfit(report, expense, toolDepreciation);
  return { label, report, expense, toolDepreciation, net, sales, operating };
}

export default async function ProfitReportPage() {
  const session = await requireSession();
  const today = new Date();
  const dayStart = startOfDay(today);
  const weekStart = startOfWeek(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const trendStart = new Date(today);
  trendStart.setDate(today.getDate() - 13);
  trendStart.setHours(0, 0, 0, 0);

  const [day, week, month] = await Promise.all(
    [dayStart, weekStart, monthStart].map((from) =>
      db.salesOrder.aggregate({
        where: { tenantId: session.tenantId, orderedAt: { gte: from }, deletedAt: null },
        _sum: { receivedAmount: true, grossProfit: true, netProfit: true, productCost: true, shippingCost: true, packagingCost: true, platformFee: true, paymentFee: true, afterSaleCost: true, adCost: true },
        _count: true
      })
    )
  );

  const [dayExpense, weekExpense, monthExpense, toolAssets, recentOrders, skuItems, shopOrders, afterSales, printers, materialUsage, competitors, opportunities] = await Promise.all([
    db.expense.aggregate({ where: { tenantId: session.tenantId, occurredAt: { gte: dayStart }, deletedAt: null }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { tenantId: session.tenantId, occurredAt: { gte: weekStart }, deletedAt: null }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { tenantId: session.tenantId, occurredAt: { gte: monthStart }, deletedAt: null }, _sum: { amount: true } }),
    db.toolAsset.findMany({ where: { tenantId: session.tenantId, status: "ACTIVE", deletedAt: null } }),
    db.salesOrder.findMany({
      where: { tenantId: session.tenantId, orderedAt: { gte: trendStart }, deletedAt: null },
      select: { orderedAt: true, receivedAmount: true, netProfit: true, grossProfit: true, afterSaleCost: true, adCost: true },
      orderBy: { orderedAt: "asc" },
      take: 20000
    }),
    db.salesOrderItem.findMany({
      where: { tenantId: session.tenantId, salesOrder: { tenantId: session.tenantId, orderedAt: { gte: monthStart }, deletedAt: null } },
      select: { skuId: true, skuName: true, quantity: true, saleAmount: true, productCost: true, sku: { select: { skuCode: true } }, salesOrder: { select: { itemSaleAmount: true, netProfit: true, afterSaleCost: true } } },
      take: 20000
    }),
    db.salesOrder.findMany({
      where: { tenantId: session.tenantId, orderedAt: { gte: monthStart }, deletedAt: null },
      select: { shopId: true, receivedAmount: true, netProfit: true, afterSaleCost: true, shop: { select: { name: true } } },
      take: 20000
    }),
    db.afterSale.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, select: { type: true, totalCost: true }, take: 20000 }),
    db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, include: { productionOrders: { where: { tenantId: session.tenantId, deletedAt: null } } } }),
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId, type: "PRODUCTION_CONSUME", createdAt: { gte: monthStart } }, select: { category: true, quantity: true, totalCost: true }, take: 20000 }),
    db.productCompetitor.findMany({ where: { tenantId: session.tenantId, status: "ACTIVE" }, select: { id: true, productId: true, platform: true, title: true, currentPrice: true, salesDisplayValue: true, salesEstimate: true, salesActual: true, dataSource: true }, take: 500 }),
    db.productOpportunity.findMany({ where: { tenantId: session.tenantId }, orderBy: { opportunityScore: "desc" }, take: 5 })
  ]);

  const monthlyToolDepreciation = toolAssets.reduce((sum, item) => sum.plus(item.monthlyDepreciation), new Prisma.Decimal(0));
  const cards = [
    periodCard("今日利润", day, dayExpense, monthlyToolDepreciation.div(30)),
    periodCard("本周利润", week, weekExpense, monthlyToolDepreciation.mul(7).div(30)),
    periodCard("本月利润", month, monthExpense, monthlyToolDepreciation)
  ];

  const trend = new Map<string, { sales: Prisma.Decimal; gross: Prisma.Decimal; net: Prisma.Decimal; afterSale: Prisma.Decimal; ad: Prisma.Decimal; orders: number }>();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(5, 10);
    trend.set(key, { sales: new Prisma.Decimal(0), gross: new Prisma.Decimal(0), net: new Prisma.Decimal(0), afterSale: new Prisma.Decimal(0), ad: new Prisma.Decimal(0), orders: 0 });
  }
  for (const order of recentOrders) {
    const key = order.orderedAt.toISOString().slice(5, 10);
    const row = trend.get(key);
    if (!row) continue;
    row.sales = row.sales.plus(order.receivedAmount);
    row.gross = row.gross.plus(order.grossProfit);
    row.net = row.net.plus(order.netProfit);
    row.afterSale = row.afterSale.plus(order.afterSaleCost);
    row.ad = row.ad.plus(order.adCost);
    row.orders++;
  }

  const skuRows = new Map<string, { name: string; quantity: number; sales: Prisma.Decimal; cost: Prisma.Decimal; net: Prisma.Decimal; afterSales: number }>();
  for (const item of skuItems) {
    const key = item.skuId ?? item.skuName;
    const current = skuRows.get(key) ?? { name: item.sku?.skuCode ? `${item.sku.skuCode} · ${item.skuName}` : item.skuName, quantity: 0, sales: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), net: new Prisma.Decimal(0), afterSales: 0 };
    const share = item.salesOrder.itemSaleAmount.gt(0) ? item.saleAmount.div(item.salesOrder.itemSaleAmount) : new Prisma.Decimal(0);
    current.quantity += item.quantity;
    current.sales = current.sales.plus(item.saleAmount);
    current.cost = current.cost.plus(item.productCost);
    current.net = current.net.plus(item.salesOrder.netProfit.mul(share));
    if (item.salesOrder.afterSaleCost.gt(0)) current.afterSales++;
    skuRows.set(key, current);
  }

  const shopRows = new Map<string, { name: string; orders: number; sales: Prisma.Decimal; afterSale: Prisma.Decimal; net: Prisma.Decimal }>();
  for (const order of shopOrders) {
    const key = order.shopId ?? "unassigned";
    const current = shopRows.get(key) ?? { name: order.shop?.name ?? "未分配店铺", orders: 0, sales: new Prisma.Decimal(0), afterSale: new Prisma.Decimal(0), net: new Prisma.Decimal(0) };
    current.orders++;
    current.sales = current.sales.plus(order.receivedAmount);
    current.afterSale = current.afterSale.plus(order.afterSaleCost);
    current.net = current.net.plus(order.netProfit);
    shopRows.set(key, current);
  }

  const afterSaleTotal = afterSales.reduce((sum, item) => sum.plus(item.totalCost), new Prisma.Decimal(0));
  const materialCost = materialUsage.reduce((sum, item) => sum.plus(item.totalCost), new Prisma.Decimal(0));
  const materialGrams = materialUsage.reduce((sum, item) => sum.plus(item.quantity.abs()), new Prisma.Decimal(0));
  const printerCompleted = printers.reduce((sum, printer) => sum + printer.productionOrders.reduce((total, order) => total + order.completedQuantity, 0), 0);
  const printerFailed = printers.reduce((sum, printer) => sum + printer.productionOrders.reduce((total, order) => total + order.failedQuantity, 0), 0);
  const competitorWithEstimate = competitors.filter((item) => item.salesEstimate || item.salesActual).length;

  const reportLinks = [
    { title: "SKU 利润排行", href: "/app/reports/sku-profit", summary: "找出赚钱 SKU、亏损 SKU 和高售后 SKU。" },
    { title: "店铺利润排行", href: "/app/reports/shop-profit", summary: "比较拼多多、淘宝、抖音、线下等渠道净利。" },
    { title: "售后损失", href: "/app/reports/after-sales", summary: "查看退款、补发、破损、错发等损失。" },
    { title: "打印机效率", href: "/app/reports/printer-efficiency", summary: "分析产量、失败率、折旧和设备成本。" },
    { title: "耗材使用", href: "/app/reports/material-usage", summary: "统计材料消耗克数、损耗和生产成本。" },
    { title: "竞品分析", href: "/app/products?tab=competitors", summary: "在产品中心查看竞品价格、展示销量、估算销量和真实销量。" },
    { title: "自动选品分析", href: "/app/products?tab=opportunities", summary: "在产品中心查看机会评分并转为产品草稿。" }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="报表中心"
        title="经营利润驾驶舱"
        description="围绕订单毛利、订单净利、经营净利润、SKU、店铺、售后、打印机效率、耗材使用、竞品分析和自动选品分析，帮助老板判断到底赚不赚钱。"
      >
        <Link href="/app/exports" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">导出数据</Link>
        <Link href="/app/help/reports" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">查看教程</Link>
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <MetricCard
            key={card.label}
            title={card.label}
            value={money(card.net)}
            description={`销售 ${money(card.sales)} · 经营净利润 ${money(card.operating)}`}
            tone={card.net.gte(0) ? "success" : "danger"}
          />
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="本月经营净利润" value={money(cards[2].operating)} description={`订单净利 ${money(cards[2].net)} - 费用 ${money(expenseSum(monthExpense))} - 折旧 ${money(monthlyToolDepreciation)}`} tone={cards[2].operating.gte(0) ? "success" : "danger"} />
        <MetricCard title="本月订单毛利" value={money(orderSum(month, "grossProfit"))} description={`订单毛利率 ${percent(orderSum(month, "grossProfit") ?? new Prisma.Decimal(0), orderSum(month, "receivedAmount") ?? new Prisma.Decimal(0))}`} tone="brand" />
        <MetricCard title="售后损失" value={money(afterSaleTotal)} description="退款、补发、破损等损失" tone={afterSaleTotal.gt(0) ? "warning" : "success"} />
        <MetricCard title="耗材使用" value={`${materialGrams.toFixed(1)} g`} description={`本月消耗成本 ${money(materialCost)}`} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">利润趋势</h2>
            <p className="mt-1 text-sm text-slate-500">最近 14 天销售额、订单毛利、订单净利、广告和售后变化。</p>
          </div>
          <StatusBadge tone="info">按下单时间</StatusBadge>
        </div>
        <DataTable
          headers={["日期", "订单数", "销售额", "订单毛利", "订单净利", "广告成本", "售后成本", "净利率"]}
          rows={[...trend.entries()].map(([date, row]) => [date, row.orders, money(row.sales), money(row.gross), money(row.net), money(row.ad), money(row.afterSale), percent(row.net, row.sales)])}
          emptyText="暂无利润趋势"
          emptyDescription="导入或录入订单后，这里会显示每日销售、成本和利润变化。"
          alignRightColumns={[1, 2, 3, 4, 5, 6, 7]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-ink">SKU 利润排行</h2><Link href="/app/reports/sku-profit" className="text-sm font-semibold text-brand">查看全部</Link></div>
          <DataTable
            headers={["SKU", "销量", "销售额", "分摊净利", "净利率", "售后订单"]}
            rows={[...skuRows.values()].sort((a, b) => b.net.minus(a.net).toNumber()).slice(0, 8).map((item) => [item.name, item.quantity, money(item.sales), money(item.net), percent(item.net, item.sales), item.afterSales])}
            emptyText="暂无 SKU 利润"
            emptyDescription="需要订单关联 SKU 后才能统计。"
            alignRightColumns={[1, 2, 3, 4, 5]}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-ink">店铺利润排行</h2><Link href="/app/reports/shop-profit" className="text-sm font-semibold text-brand">查看全部</Link></div>
          <DataTable
            headers={["店铺", "订单数", "销售额", "售后损失", "净利润", "净利率"]}
            rows={[...shopRows.values()].sort((a, b) => b.net.minus(a.net).toNumber()).slice(0, 8).map((item) => [item.name, item.orders, money(item.sales), money(item.afterSale), money(item.net), percent(item.net, item.sales)])}
            emptyText="暂无店铺利润"
            emptyDescription="先维护店铺并录入订单。"
            alignRightColumns={[1, 2, 3, 4, 5]}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="打印机效率" value={`${printerCompleted} 件`} description={`失败 ${printerFailed} 件 · 设备 ${printers.length} 台`} tone={printerFailed > 0 ? "warning" : "success"} />
        <MetricCard title="竞品分析" value={`${competitors.length} 条`} description={`有估算/真实销量 ${competitorWithEstimate} 条，展示销量不等于真实销量`} tone="brand" />
        <MetricCard title="自动选品分析" value={`${opportunities.length} 个机会`} description={opportunities[0] ? `最高评分 ${opportunities[0].opportunityScore.toFixed(1)}` : "暂无选品机会"} />
        <MetricCard title="数据完整度提醒" value="成本闭环" description="利润依赖生产、发货、售后、广告和费用完整录入" tone="warning" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-ink">专题报表入口</h2>
          <p className="mt-1 text-sm text-slate-500">从经营结果继续下钻到 SKU、店铺、售后、设备、耗材、竞品和选品。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportLinks.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-200 hover:bg-blue-50/50">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">{item.title}</p>
                <StatusBadge tone="neutral">进入</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
        <h2 className="font-semibold">利润口径说明</h2>
        <p className="mt-2">订单毛利 = 实收金额 - 产品生产成本 - 快递成本 - 包装成本 - 平台佣金 - 支付手续费。</p>
        <p>订单净利 = 订单毛利 - 售后成本 - 广告成本。经营净利润 = 订单净利 - 固定费用 - 工具设备折旧。</p>
      </section>
    </div>
  );
}

