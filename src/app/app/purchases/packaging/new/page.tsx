import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayInputValue } from "@/lib/business-date";

export default async function NewPackagingPurchasePage() {
  const session = await requireSession();
  const [suppliers, packaging] = await Promise.all([
    db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.packagingItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  return <FormShell title="包装材料采购入库" description="自动更新包装库存移动平均成本并生成采购入库流水。" action="/api/purchases/packaging" backHref="/app/purchases">
    <Field label="采购单号" name="orderNo" required defaultValue={`PK-${Date.now()}`} />
    <Field label="采购日期" name="purchaseDate" type="date" required defaultValue={todayInputValue()} />
    <SelectField label="供应商" name="supplierId" options={suppliers.map(item => ({ value: item.id, label: item.name }))} />
    <SelectField label="包装材料" name="packagingItemId" required options={packaging.map(item => ({ value: item.id, label: `${item.name} · ${item.spec ?? ""}` }))} />
    <div className="grid gap-4 md:grid-cols-2"><Field label="入库数量" name="quantity" type="number" step="0.001" required /><Field label="采购金额" name="purchaseAmount" type="number" step="0.01" required /><Field label="采购运费" name="shippingFee" type="number" step="0.01" defaultValue="0" /><Field label="税费" name="taxFee" type="number" step="0.01" defaultValue="0" /><Field label="优惠金额" name="discountAmount" type="number" step="0.01" defaultValue="0" /></div>
  </FormShell>;
}
