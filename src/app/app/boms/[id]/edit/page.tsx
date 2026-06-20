import { notFound } from "next/navigation";
import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditBomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [bom, materials, packaging, printers] = await Promise.all([
    db.productBom.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { sku: true, items: true } }),
    db.material.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.packagingItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  if (!bom) notFound();
  const packageItem = bom.items.find(item => item.category === "PACKAGING");
  return <FormShell title={`编辑 BOM · ${bom.sku.skuCode}`} description="保存时会按当前库存成本重新计算理论产品成本。" action={`/api/boms/${bom.id}`} backHref="/app/boms">
    <SelectField label="默认耗材" name="defaultMaterialId" required defaultValue={bom.defaultMaterialId ?? ""} options={materials.map(item => ({ value: item.id, label: `${item.name} · ${item.type}` }))} />
    <div className="grid gap-4 md:grid-cols-2"><Field label="理论耗材克数" name="theoreticalGrams" type="number" step="0.001" defaultValue={bom.theoreticalGrams.toString()} required /><Field label="支撑 / 损耗克数" name="wasteGrams" type="number" step="0.001" defaultValue={bom.wasteGrams.toString()} /></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="预计打印小时" name="estimatedPrintHours" type="number" step="0.01" defaultValue={bom.estimatedPrintHours.toString()} /><SelectField label="估算折旧使用的打印机" name="printerId" options={printers.map(item => ({ value: item.id, label: `${item.name} · ${item.depreciationPerHour}/小时` }))} /></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="人工分钟数" name="laborMinutes" type="number" step="0.01" defaultValue={bom.laborMinutes.toString()} /><Field label="每分钟人工成本" name="laborCostPerMinute" type="number" step="0.0001" defaultValue={bom.laborCostPerMinute.toString()} /></div>
    <div className="grid gap-4 md:grid-cols-2"><SelectField label="包装材料" name="packagingId" defaultValue={packageItem?.refId ?? ""} options={packaging.map(item => ({ value: item.id, label: `${item.name} · ${item.unitPrice}/${item.unit}` }))} /><Field label="包装用量" name="packagingQuantity" type="number" step="0.001" defaultValue={packageItem?.quantity.toString() ?? "0"} /></div>
    <Field label="电费" name="electricityCost" type="number" step="0.01" defaultValue={bom.electricityCost.toString()} />
    <Field label="备注" name="remark" defaultValue={bom.remark ?? ""} />
  </FormShell>;
}
