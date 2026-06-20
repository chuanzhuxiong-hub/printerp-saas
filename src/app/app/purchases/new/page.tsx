import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { weightUnits } from "@/lib/weight";
import { todayInputValue } from "@/lib/business-date";

export default async function NewPurchasePage() {
  const session = await requireSession();
  const [suppliers, materials] = await Promise.all([
    db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.material.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  const suffix = Date.now();
  return <FormShell title="耗材采购入库" description="收货后自动创建耗材批次、更新移动平均成本并生成库存流水。" action="/api/purchases" backHref="/app/purchases">
    <Field label="采购单号" name="orderNo" required defaultValue={`PO-${suffix}`} />
    <Field label="耗材批次号" name="batchNo" required defaultValue={`MB-${suffix}`} />
    <Field label="采购日期" name="purchaseDate" type="date" required defaultValue={todayInputValue()} />
    <SelectField label="供应商" name="supplierId" options={suppliers.map(item => ({ value: item.id, label: item.name }))} />
    <SelectField label="耗材" name="materialId" required options={materials.map(item => ({ value: item.id, label: `${item.type} · ${item.name}` }))} />
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="入库重量" name="purchaseWeight" type="number" step="0.001" required />
      <SelectField label="重量单位" name="weightUnit" defaultValue="KG" options={weightUnits.map(unit => ({ value: unit.value, label: unit.label }))} />
      <Field label="采购金额" name="purchaseAmount" type="number" step="0.01" required />
      <Field label="采购运费" name="shippingFee" type="number" step="0.01" defaultValue="0" />
      <Field label="税费" name="taxFee" type="number" step="0.01" defaultValue="0" />
      <Field label="优惠金额" name="discountAmount" type="number" step="0.01" defaultValue="0" />
    </div>
  </FormShell>;
}
