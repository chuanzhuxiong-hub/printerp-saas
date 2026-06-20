import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  if (["COMPLETED", "SHIPPED", "STOCKED"].includes(status)) return "success";
  if (["PAID", "PRODUCTION_PENDING", "SHIPPING_PENDING", "PENDING", "PRINTING", "QC_PENDING"].includes(status)) return "warning";
  if (["REFUNDED", "CANCELLED", "AFTERSALE", "FAILED", "SCRAPPED"].includes(status)) return "danger";
  return "neutral";
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const order = await db.salesOrder.findFirst({
    where: { id, tenantId: session.tenantId, deletedAt: null },
    include: { shop: true, items: { include: { sku: true } }, shipments: { include: { items: true }, where: { deletedAt: null } }, afterSales: { where: { deletedAt: null } } }
  });
  if (!order) notFound();

  const production = await db.productionOrder.findMany({
    where: { tenantId: session.tenantId, salesOrderId: order.id, deletedAt: null },
    include: { printer: true },
    orderBy: { createdAt: "desc" }
  });
  const [costs, audits] = await Promise.all([
    db.costRecord.findMany({ where: { tenantId: session.tenantId, salesOrderId: order.id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({
      where: { tenantId: session.tenantId, OR: [{ entityId: order.id }, { entityId: { in: [...order.shipments.map((item) => item.id), ...order.afterSales.map((item) => item.id), ...production.map((item) => item.id)] } }] },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const firstSkuId = order.items.find((item) => item.skuId)?.skuId ?? "";
  const netProfitTone = order.netProfit.lt(0) ? "danger" : "success";
  const afterSaleActive = order.status === "AFTERSALE" || order.afterSaleStatus || order.afterSales.length > 0 || order.afterSaleCost.gt(0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="订单工作台"
        title={`订单 ${order.orderNo}`}
        description={`${order.shop?.name ?? "未分配店铺"} · ${order.customerName ?? "未填写客户"} · 订单概览、利润明细、商品明细、生产记录、发货记录、售后记录、成本追溯和操作日志集中在这里。`}
      >
        <Link href="/app/orders" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">返回订单中心</Link>
        <Link href={`/app/production/new?orderId=${order.id}&skuId=${firstSkuId}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-brand hover:bg-blue-50">创建生产任务</Link>
        {order.shipmentStatus === "PENDING" && <Link href={`/app/shipments/new?orderId=${order.id}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">为此订单发货</Link>}
        <Link href={`/app/after-sales/new?orderId=${order.id}`} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">登记售后</Link>
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="实收金额" value={money(order.receivedAmount)} description="订单实际收款" tone="brand" />
        <MetricCard title="产品成本" value={money(order.productCost)} description="生产/BOM 成本" />
        <MetricCard title="快递成本" value={money(order.shippingCost)} description="发货物流成本" />
        <MetricCard title="包装成本" value={money(order.packagingCost)} description="包装材料成本" />
        <MetricCard title="售后成本" value={money(order.afterSaleCost)} description="退款、补发、破损损失" tone={afterSaleActive ? "warning" : "success"} />
        <MetricCard title="当前净利" value={money(order.netProfit)} description={`毛利 ${money(order.grossProfit)}`} tone={netProfitTone} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <div>
          <p className="text-sm text-slate-500">订单状态</p>
          <div className="mt-2"><StatusBadge tone={statusTone(order.status)}>{order.status}</StatusBadge></div>
        </div>
        <div>
          <p className="text-sm text-slate-500">发货状态</p>
          <div className="mt-2"><StatusBadge tone={statusTone(order.shipmentStatus)}>{order.shipmentStatus}</StatusBadge></div>
        </div>
        <div>
          <p className="text-sm text-slate-500">售后状态</p>
          <div className="mt-2"><StatusBadge tone={afterSaleActive ? "danger" : "success"}>{afterSaleActive ? (order.afterSaleStatus ?? "售后中") : "无售后"}</StatusBadge></div>
        </div>
        <div>
          <p className="text-sm text-slate-500">下单时间</p>
          <p className="mt-2 font-semibold text-ink">{order.orderedAt.toLocaleString("zh-CN")}</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">利润明细</h2>
        <DataTable
          headers={["项目", "金额", "说明"]}
          rows={[
            ["实收金额", money(order.receivedAmount), "平台订单实际收款"],
            ["产品生产成本", money(order.productCost), "BOM、生产、打印耗材等成本"],
            ["快递成本", money(order.shippingCost), "发货物流成本"],
            ["包装成本", money(order.packagingCost), "包装材料成本"],
            ["平台佣金", money(order.platformFee), "平台扣费"],
            ["支付手续费", money(order.paymentFee), "支付通道扣费"],
            ["广告成本", money(order.adCost), "推广费用"],
            ["售后成本", money(order.afterSaleCost), "退款、补发、破损、人工等损失"],
            ["订单毛利", money(order.grossProfit), "实收金额扣除主要履约成本"],
            ["订单净利", money(order.netProfit), "毛利扣除售后与广告等成本"]
          ]}
          alignRightColumns={[1]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">商品明细</h2>
        <DataTable
          headers={["SKU", "名称", "数量", "单价", "销售额", "产品成本"]}
          rows={order.items.map((item) => [item.sku?.skuCode ?? "-", item.skuName, item.quantity, money(item.unitPrice), money(item.saleAmount), money(item.productCost)])}
          alignRightColumns={[2, 3, 4, 5]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">生产记录</h2>
        <DataTable
          headers={["生产单号", "打印机", "计划", "完成", "失败", "实际成本", "状态"]}
          rows={production.map((item) => [
            <Link key={item.id} className="font-semibold text-brand" href={`/app/production/${item.id}`}>{item.orderNo}</Link>,
            item.printer?.name ?? "-",
            item.plannedQuantity,
            item.completedQuantity,
            item.failedQuantity,
            money(item.actualCost),
            <StatusBadge key={`${item.id}-status`} tone={statusTone(item.status)}>{item.status}</StatusBadge>
          ])}
          emptyText="暂无生产记录"
          emptyDescription="订单需要生产时，在订单详情中创建生产任务。"
          emptyActionHref={`/app/production/new?orderId=${order.id}&skuId=${firstSkuId}`}
          emptyActionLabel="创建生产任务"
          alignRightColumns={[2, 3, 4, 5]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">发货记录</h2>
        <DataTable
          headers={["快递", "运单号", "快递成本", "包装成本", "发货时间", "状态"]}
          rows={order.shipments.map((item) => [
            item.carrier ?? "-",
            <Link key={item.id} className="font-semibold text-brand" href={`/app/shipments/${item.id}`}>{item.trackingNo ?? "查看发货记录"}</Link>,
            money(item.shippingCost),
            money(item.packagingCost),
            item.shippedAt?.toLocaleString("zh-CN") ?? "-",
            <StatusBadge key={`${item.id}-status`} tone={statusTone(item.status)}>{item.status}</StatusBadge>
          ])}
          emptyText="暂无发货记录"
          emptyDescription="发货会扣减成品和包装库存，并影响订单利润。"
          emptyActionHref={`/app/shipments/new?orderId=${order.id}`}
          emptyActionLabel="为此订单发货"
          alignRightColumns={[2, 3]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">售后记录</h2>
        <DataTable
          headers={["类型", "原因", "退款", "补发成本", "总成本", "处理时间"]}
          rows={order.afterSales.map((item) => [item.type, item.reason ?? "-", money(item.refundAmount), money(item.resendProductCost.plus(item.resendShippingCost).plus(item.resendPackagingCost)), money(item.totalCost), item.handledAt.toLocaleString("zh-CN")])}
          emptyText="暂无售后记录"
          emptyDescription="退款、补发、发错货、破损等售后成本会影响订单最终利润。"
          emptyActionHref={`/app/after-sales/new?orderId=${order.id}`}
          emptyActionLabel="登记售后"
          alignRightColumns={[2, 3, 4]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">成本追溯</h2>
        <DataTable headers={["来源类型", "金额", "备注", "记录时间"]} rows={costs.map((item) => [item.sourceType, money(item.amount), item.remark ?? "-", item.createdAt.toLocaleString("zh-CN")])} alignRightColumns={[1]} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">操作日志</h2>
        <DataTable headers={["动作", "实体", "时间"]} rows={audits.map((item) => [item.action, item.entityType, item.createdAt.toLocaleString("zh-CN")])} />
      </section>
    </div>
  );
}
