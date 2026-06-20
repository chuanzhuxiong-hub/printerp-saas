import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const shipment = await db.shipment.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { salesOrder: true, items: true } }); if (!shipment) notFound();
  const [transactions, audits] = await Promise.all([
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId, sourceType: "Shipment", sourceId: shipment.id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { tenantId: session.tenantId, entityId: shipment.id }, orderBy: { createdAt: "desc" } })
  ]);
  return <main><PageHeader title={`发货单 ${shipment.trackingNo ?? shipment.id}`} description={`${shipment.carrier ?? "未填写快递"} · ${shipment.status}`} />
    <div className="mt-4"><Link className="font-semibold text-brand" href={`/app/orders/${shipment.salesOrder.id}`}>查看订单 {shipment.salesOrder.orderNo}</Link></div>
    <div className="mt-6 grid gap-4 md:grid-cols-3">{[["快递成本", shipment.shippingCost], ["包装成本", shipment.packagingCost], ["发货时间", shipment.shippedAt?.toLocaleString("zh-CN") ?? "-"]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-4 shadow-soft"><p className="text-sm text-muted">{String(label)}</p><p className="mt-2 text-xl font-bold">{value.toString()}</p></div>)}</div>
    <h2 className="mt-8 text-lg font-semibold">出库明细</h2><DataTable headers={["类别", "引用 ID", "数量", "单位成本", "总成本"]} rows={shipment.items.map(item => [item.category, item.refId, item.quantity.toString(), item.unitCost.toString(), item.totalCost.toString()])} />
    <h2 className="mt-8 text-lg font-semibold">库存流水</h2><DataTable headers={["类型", "类别", "数量", "总成本"]} rows={transactions.map(item => [item.type, item.category, item.quantity.toString(), item.totalCost.toString()])} />
    <h2 className="mt-8 text-lg font-semibold">操作日志</h2><DataTable headers={["动作", "时间"]} rows={audits.map(item => [item.action, item.createdAt.toLocaleString("zh-CN")])} />
  </main>;
}
