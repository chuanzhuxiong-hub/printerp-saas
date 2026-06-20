import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const orders = await db.salesOrder.findMany({
    where: { tenantId: session.tenantId, deletedAt: null, shipmentStatus: "PENDING", status: { notIn: ["CANCELLED", "REFUNDED"] } },
    orderBy: { orderedAt: "desc" },
    take: 100
  });
  return <FormShell title="订单发货" description="发货后自动扣减成品与 BOM 包装库存，并重算订单利润。" action="/api/shipments" backHref="/app/shipments">
    <SelectField label="销售订单" name="salesOrderId" required defaultValue={query.orderId} options={orders.map(item => ({ value: item.id, label: `${item.orderNo} · 实收 ${item.receivedAmount}` }))} />
    <Field label="快递公司" name="carrier" required placeholder="例如：顺丰速运" />
    <Field label="运单号" name="trackingNo" required />
    <Field label="快递费用" name="shippingCost" type="number" step="0.01" defaultValue="0" required />
  </FormShell>;
}
