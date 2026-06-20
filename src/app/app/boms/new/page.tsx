import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewBomPage({ searchParams }: { searchParams: Promise<{ skuId?: string; returnTo?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [skus, materials, packaging, printers] = await Promise.all([
    db.productSku.findMany({ where: { tenantId: session.tenantId, deletedAt: null, bom: null }, orderBy: { name: "asc" } }),
    db.material.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.packagingItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  return <FormShell title="新增产品 BOM" description="按当前耗材移动平均成本、包装单价、人工和打印机折旧自动估算理论成本。" action="/api/boms" backHref={query.returnTo?.startsWith("/app/products/") ? query.returnTo : "/app/boms"}>
    <input type="hidden" name="returnTo" value={query.returnTo ?? ""} />
    <SelectField label="SKU" name="skuId" required defaultValue={query.skuId} options={skus.map(item => ({ value: item.id, label: `${item.skuCode} · ${item.name}` }))} />
    <SelectField label="默认耗材" name="defaultMaterialId" required options={materials.map(item => ({ value: item.id, label: `${item.name} · ${item.type}` }))} />
    <div className="grid gap-4 md:grid-cols-2"><Field label="理论耗材克数" name="theoreticalGrams" type="number" step="0.001" defaultValue="0" required /><Field label="支撑 / 损耗克数" name="wasteGrams" type="number" step="0.001" defaultValue="0" /></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="预计打印小时" name="estimatedPrintHours" type="number" step="0.01" defaultValue="0" /><SelectField label="估算折旧使用的打印机" name="printerId" options={printers.map(item => ({ value: item.id, label: `${item.name} · ${item.depreciationPerHour}/小时` }))} /></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="人工分钟数" name="laborMinutes" type="number" step="0.01" defaultValue="0" /><Field label="每分钟人工成本" name="laborCostPerMinute" type="number" step="0.0001" defaultValue="0" /></div>
    <div className="grid gap-4 md:grid-cols-2"><SelectField label="包装材料" name="packagingId" options={packaging.map(item => ({ value: item.id, label: `${item.name} · ${item.unitPrice}/${item.unit}` }))} /><Field label="包装用量" name="packagingQuantity" type="number" step="0.001" defaultValue="0" /></div>
    <Field label="电费" name="electricityCost" type="number" step="0.01" defaultValue="0" />
    <Field label="备注" name="remark" />
  </FormShell>;
}
