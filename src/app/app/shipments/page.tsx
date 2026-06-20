import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ShipmentsPage() {
  const session = await requireSession();
  const shipments = await db.shipment.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    include: { salesOrder: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return <main>
    <PageHeader title="发货管理" description={`共 ${shipments.length} 条发货记录，发货将自动扣减成品和包装库存。`} actionHref="/app/shipments/new" actionLabel="订单发货" />
    <DataTable headers={["订单号", "快递公司", "运单号", "快递成本", "包装成本", "发货时间", "状态"]} rows={shipments.map(item => [
      <Link className="font-semibold text-brand" href={`/app/orders/${item.salesOrder.id}`}>{item.salesOrder.orderNo}</Link>, item.carrier ?? "-", <Link className="font-semibold text-brand" href={`/app/shipments/${item.id}`}>{item.trackingNo ?? "查看详情"}</Link>, item.shippingCost.toString(), item.packagingCost.toString(),
      item.shippedAt?.toLocaleString("zh-CN") ?? "-", item.status
    ])} />
  </main>;
}
