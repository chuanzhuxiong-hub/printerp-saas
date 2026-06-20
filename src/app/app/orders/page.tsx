import { OrderStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageCount, parsePagination } from "@/lib/pagination";

type OrderTab = "ALL" | "PRODUCTION_PENDING" | "SHIPPING_PENDING" | "SHIPPED" | "AFTERSALE" | "ABNORMAL";

const tabs: Array<{ key: OrderTab; label: string; description: string }> = [
  { key: "ALL", label: "全部", description: "全部订单" },
  { key: "PRODUCTION_PENDING", label: "待生产", description: "需要创建或跟进生产任务" },
  { key: "SHIPPING_PENDING", label: "待发货", description: "生产完成或等待物流" },
  { key: "SHIPPED", label: "已发货", description: "物流已出库" },
  { key: "AFTERSALE", label: "售后中", description: "退款、补发或异常处理" },
  { key: "ABNORMAL", label: "异常订单", description: "亏损、售后成本或履约风险" }
];

function activeTab(value?: string): OrderTab {
  return tabs.some((tab) => tab.key === value) ? value as OrderTab : "ALL";
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return `¥${new Prisma.Decimal(value ?? 0).toFixed(2)}`;
}

function orderStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (["COMPLETED", "SHIPPED"].includes(status)) return "success";
  if (["PRODUCTION_PENDING", "SHIPPING_PENDING", "PAID"].includes(status)) return "warning";
  if (["REFUNDED", "CANCELLED", "AFTERSALE"].includes(status)) return "danger";
  return "neutral";
}

function productionSummary(statuses: string[]) {
  if (!statuses.length) return { label: "未创建", tone: "warning" as const };
  if (statuses.some((status) => ["FAILED", "REWORK", "SCRAPPED"].includes(status))) return { label: "生产异常", tone: "danger" as const };
  if (statuses.some((status) => ["PENDING", "PRINTING", "QC_PENDING"].includes(status))) return { label: "生产中", tone: "info" as const };
  return { label: "已完成", tone: "success" as const };
}

function shipmentSummary(status: string) {
  if (status === "SHIPPED") return { label: "已发货", tone: "success" as const };
  if (status === "RETURNED") return { label: "已退回", tone: "danger" as const };
  return { label: "待发货", tone: "warning" as const };
}

function afterSaleSummary(order: { status: string; afterSaleStatus: string | null; afterSales: unknown[]; afterSaleCost: Prisma.Decimal }) {
  if (order.status === "AFTERSALE" || order.afterSaleStatus || order.afterSales.length || order.afterSaleCost.gt(0)) {
    return { label: "售后中", tone: "danger" as const };
  }
  return { label: "无售后", tone: "success" as const };
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{ imported?: string; skipped?: string; createdSkus?: string; platform?: string; tab?: string; keyword?: string; shopId?: string; page?: string; pageSize?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const tab = activeTab(query.tab);
  const keyword = query.keyword?.trim();
  const pagination = parsePagination(query, { pageSize: 30, maxPageSize: 100 });

  const baseWhere: Prisma.SalesOrderWhereInput = {
    tenantId: session.tenantId,
    deletedAt: null,
    shopId: query.shopId && query.shopId !== "ALL" ? query.shopId : undefined,
    OR: keyword ? [
      { orderNo: { contains: keyword, mode: "insensitive" } },
      { customerName: { contains: keyword, mode: "insensitive" } },
      { customerRegion: { contains: keyword, mode: "insensitive" } },
      { shop: { name: { contains: keyword, mode: "insensitive" } } },
      { items: { some: { skuName: { contains: keyword, mode: "insensitive" } } } }
    ] : undefined
  };

  const tabWhere: Prisma.SalesOrderWhereInput = tab === "ALL" ? baseWhere
    : tab === "ABNORMAL" ? { ...baseWhere, OR: [{ netProfit: { lt: 0 } }, { afterSaleCost: { gt: 0 } }, { status: { in: ["REFUNDED", "CANCELLED"] as OrderStatus[] } }] }
    : { ...baseWhere, status: tab };

  const [orders, total, sum, shops, tabCounts] = await Promise.all([
    db.salesOrder.findMany({
      where: tabWhere,
      include: {
        shop: true,
        items: { take: 3, include: { sku: true } },
        shipments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 3 },
        afterSales: { where: { deletedAt: null }, orderBy: { handledAt: "desc" }, take: 3 }
      },
      orderBy: { orderedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take
    }),
    db.salesOrder.count({ where: tabWhere }),
    db.salesOrder.aggregate({ where: tabWhere, _sum: { receivedAmount: true, netProfit: true, grossProfit: true, afterSaleCost: true }, _count: true }),
    db.shop.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    Promise.all(tabs.map(async (item) => {
      const where = item.key === "ALL" ? baseWhere
        : item.key === "ABNORMAL" ? { ...baseWhere, OR: [{ netProfit: { lt: 0 } }, { afterSaleCost: { gt: 0 } }, { status: { in: ["REFUNDED", "CANCELLED"] as OrderStatus[] } }] }
        : { ...baseWhere, status: item.key };
      return [item.key, await db.salesOrder.count({ where })] as const;
    }))
  ]);

  const orderIds = orders.map((order) => order.id);
  const production = orderIds.length
    ? await db.productionOrder.findMany({ where: { tenantId: session.tenantId, salesOrderId: { in: orderIds }, deletedAt: null }, select: { salesOrderId: true, status: true } })
    : [];
  const productionByOrder = new Map<string, string[]>();
  for (const item of production) {
    if (!item.salesOrderId) continue;
    productionByOrder.set(item.salesOrderId, [...(productionByOrder.get(item.salesOrderId) ?? []), item.status]);
  }

  const countMap = new Map(tabCounts);
  const totalPages = pageCount(total, pagination.pageSize);
  const makeHref = (next: Partial<{ tab: string; page: number; keyword: string; shopId: string }>) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    if (next.keyword ?? keyword) params.set("keyword", next.keyword ?? keyword ?? "");
    if (next.shopId ?? query.shopId) params.set("shopId", next.shopId ?? query.shopId ?? "ALL");
    params.set("page", String(next.page ?? pagination.page));
    params.set("pageSize", String(pagination.pageSize));
    return `/app/orders?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="电商订单后台"
        title="订单中心"
        description="状态 Tabs、搜索筛选、生产状态、发货状态、售后状态和利润明细集中在订单中心。发货和售后不拆成一级菜单，统一进入订单详情处理。"
        actionHref="/app/orders/new"
        actionLabel="录入订单"
      >
        <Link href="/app/orders/import" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">平台订单导入</Link>
        <Link href="/app/cost-imports" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">快递/广告费用导入</Link>
      </PageHeader>

      {query.imported !== undefined && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {query.platform ?? "GENERIC"} 导入完成：新增 {query.imported} 个订单，跳过 {query.skipped ?? "0"} 条记录，自动创建 {query.createdSkus ?? "0"} 个 SKU。
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="筛选订单数" value={sum._count} description="当前条件下的订单数量" tone="brand" />
        <MetricCard title="实收金额" value={money(sum._sum.receivedAmount)} description="订单实际收款合计" />
        <MetricCard title="净利润" value={money(sum._sum.netProfit)} description={`毛利 ${money(sum._sum.grossProfit)}`} tone={(sum._sum.netProfit ?? new Prisma.Decimal(0)).gte(0) ? "success" : "danger"} />
        <MetricCard title="售后成本" value={money(sum._sum.afterSaleCost)} description="退款、补发、破损等损失" tone={(sum._sum.afterSaleCost ?? new Prisma.Decimal(0)).gt(0) ? "warning" : "success"} />
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
      <p className="sr-only">状态 Tabs</p>

      <FilterBar>
        <form action="/app/orders" method="get" className="flex w-full flex-wrap items-center gap-3">
          <input type="hidden" name="tab" value={tab} />
          <input name="keyword" defaultValue={keyword} placeholder="搜索订单号、客户、店铺、SKU" className="min-w-[280px] flex-1 rounded-lg border px-3 py-2 text-sm" />
          <select name="shopId" defaultValue={query.shopId ?? "ALL"} className="rounded-lg border px-3 py-2 text-sm">
            <option value="ALL">全部店铺</option>
            {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">筛选</button>
          <Link href="/app/orders" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">重置</Link>
        </form>
      </FilterBar>

      <DataTable
        headers={["订单", "店铺/客户", "商品", "实收", "利润明细", "生产状态", "发货状态", "售后状态", "操作"]}
        rows={orders.map((order) => {
          const productionState = productionSummary(productionByOrder.get(order.id) ?? []);
          const shippingState = shipmentSummary(order.shipmentStatus);
          const afterSaleState = afterSaleSummary(order);
          const abnormal = order.netProfit.lt(0) || order.afterSaleCost.gt(0) || ["REFUNDED", "CANCELLED"].includes(order.status);
          return [
            <div key={`${order.id}-order`}>
              <Link href={`/app/orders/${order.id}`} className="font-semibold text-brand">{order.orderNo}</Link>
              <div className="mt-1 flex flex-wrap gap-2"><StatusBadge tone={orderStatusTone(order.status)}>{order.status}</StatusBadge>{abnormal && <StatusBadge tone="danger">异常订单</StatusBadge>}</div>
              <p className="mt-1 text-xs text-slate-500">{order.orderedAt.toLocaleString("zh-CN")}</p>
            </div>,
            <div key={`${order.id}-customer`}><p className="font-medium text-ink">{order.shop?.name ?? "未分配店铺"}</p><p className="mt-1 text-xs text-slate-500">{order.customerName ?? "未填写客户"}</p></div>,
            <div key={`${order.id}-items`} className="space-y-1">{order.items.map((item) => <p key={item.id} className="text-sm text-slate-700">{item.skuName} × {item.quantity}</p>)}</div>,
            money(order.receivedAmount),
            <div key={`${order.id}-profit`} className="text-right"><p className="font-semibold text-ink">净利 {money(order.netProfit)}</p><p className="text-xs text-slate-500">毛利 {money(order.grossProfit)}</p></div>,
            <StatusBadge key={`${order.id}-production`} tone={productionState.tone}>{productionState.label}</StatusBadge>,
            <StatusBadge key={`${order.id}-shipping`} tone={shippingState.tone}>{shippingState.label}</StatusBadge>,
            <StatusBadge key={`${order.id}-after-sale`} tone={afterSaleState.tone}>{afterSaleState.label}</StatusBadge>,
            <div key={`${order.id}-actions`} className="flex justify-end gap-3"><Link href={`/app/orders/${order.id}`} className="font-semibold text-brand">详情</Link><Link href={`/app/production/new?orderId=${order.id}&skuId=${order.items.find((item) => item.skuId)?.skuId ?? ""}`} className="font-semibold text-brand">生产</Link></div>
          ];
        })}
        emptyText="暂无订单"
        emptyDescription="可以手工录入订单，也可以从拼多多、淘宝、Shopify、Etsy 等平台导入订单。"
        emptyActionHref="/app/orders/import"
        emptyActionLabel="导入订单"
        alignRightColumns={[3, 4, 8]}
      />

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

