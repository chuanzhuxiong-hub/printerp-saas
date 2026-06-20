import { notFound } from "next/navigation";
import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { weightUnits } from "@/lib/weight";

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const purchase = await db.purchaseOrder.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { items: true } });
  if (!purchase || purchase.status === "CANCELLED" || purchase.items.length !== 1) notFound();
  const item = purchase.items[0];
  const [suppliers, material, packaging, audit] = await Promise.all([
    db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    item.materialId ? db.material.findFirst({ where: { id: item.materialId, tenantId: session.tenantId } }) : null,
    item.packagingItemId ? db.packagingItem.findFirst({ where: { id: item.packagingItemId, tenantId: session.tenantId } }) : null,
    db.auditLog.findFirst({ where: { tenantId: session.tenantId, action: "purchase.received", entityId: purchase.id } })
  ]);
  const batchId = audit?.metadata && typeof audit.metadata === "object" && !Array.isArray(audit.metadata) ? String((audit.metadata as Record<string, unknown>).batchId ?? "") : "";
  const batch = batchId ? await db.materialBatch.findFirst({ where: { id: batchId, tenantId: session.tenantId } }) : null;
  const isMaterial = item.category === "MATERIAL";

  return <FormShell title={`编辑采购单 ${purchase.orderNo}`} description={`当前物料：${material?.name ?? packaging?.name ?? "未知"}。物料选错时请返回详情撤销后重新录入。`} action={`/api/purchases/${purchase.id}`} backHref={`/app/purchases/${purchase.id}`}>
    <input type="hidden" name="action" value="update" />
    <Field label="采购单号" name="orderNo" required defaultValue={purchase.orderNo} />
    <Field label="采购日期" name="purchaseDate" type="date" required defaultValue={purchase.purchaseDate.toISOString().slice(0, 10)} />
    <SelectField label="供应商" name="supplierId" defaultValue={purchase.supplierId ?? ""} options={suppliers.map(supplier => ({ value: supplier.id, label: supplier.name }))} />
    {isMaterial ? <>
      <Field label="耗材批次号" name="batchNo" required defaultValue={batch?.batchNo ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="入库重量" name="purchaseWeight" type="number" step="0.001" required defaultValue={item.quantity.div(1000).toString()} />
        <SelectField label="重量单位" name="weightUnit" defaultValue="KG" options={weightUnits.map(unit => ({ value: unit.value, label: unit.label }))} />
      </div>
    </> : <Field label="入库数量" name="quantity" type="number" step="0.001" required defaultValue={item.quantity.toString()} />}
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="采购金额" name="purchaseAmount" type="number" step="0.01" required defaultValue={purchase.purchaseAmount.toString()} />
      <Field label="采购运费" name="shippingFee" type="number" step="0.01" defaultValue={purchase.shippingFee.toString()} />
      <Field label="税费" name="taxFee" type="number" step="0.01" defaultValue={purchase.taxFee.toString()} />
      <Field label="优惠金额" name="discountAmount" type="number" step="0.01" defaultValue={purchase.discountAmount.toString()} />
    </div>
  </FormShell>;
}

