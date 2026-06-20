import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewProductionPage({ searchParams }: { searchParams: Promise<{ error?: string; orderId?: string; skuId?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [skus, printers, orders] = await Promise.all([
    db.productSku.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { code: "asc" } }),
    db.salesOrder.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { orderedAt: "desc" }, take: 100 })
  ]);
  return <FormShell title="新建生产任务" description="关联 SKU、打印机与销售订单，完成后自动处理库存和成本。" action="/api/production" backHref="/app/production" error={query.error === "duplicate" ? "生产单号已存在，请使用新的生产单号。" : undefined}>
    <Field label="生产单号" name="orderNo" required defaultValue={`PR-${Date.now()}`} />
    <SelectField label="SKU" name="skuId" required defaultValue={query.skuId} options={skus.map(item => ({ value: item.id, label: `${item.skuCode} · ${item.name}` }))} />
    <SelectField label="关联销售订单" name="salesOrderId" defaultValue={query.orderId} options={orders.map(item => ({ value: item.id, label: item.orderNo }))} />
    <SelectField label="打印机" name="printerId" options={printers.map(item => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
    <Field label="计划数量" name="plannedQuantity" type="number" defaultValue="1" required />
    <Field label="生产人员" name="assigneeName" />
    <Field label="备注" name="remark" />
  </FormShell>;
}
