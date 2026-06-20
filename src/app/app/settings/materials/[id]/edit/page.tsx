import { notFound } from "next/navigation";
import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const [item, suppliers] = await Promise.all([db.material.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } }), db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })]); if (!item) notFound();
  return <FormShell title="编辑耗材" description="修改耗材资料并同步库存主表。" action={`/api/materials/${item.id}`} backHref="/app/settings/materials"><Field label="耗材名称" name="name" required defaultValue={item.name} /><SelectField label="材质" name="type" required defaultValue={item.type} options={["PLA", "PETG", "ABS", "TPU", "OTHER"].map(value => ({ value, label: value }))} /><Field label="颜色" name="color" defaultValue={item.color ?? ""} /><Field label="品牌" name="brand" defaultValue={item.brand ?? ""} /><SelectField label="默认供应商" name="defaultSupplierId" defaultValue={item.defaultSupplierId ?? ""} options={suppliers.map(row => ({ value: row.id, label: row.name }))} /><Field label="库存警戒线（克）" name="warningStock" type="number" step="0.001" defaultValue={item.warningStock.toString()} /><Field label="备注" name="remark" defaultValue={item.remark ?? ""} /></FormShell>;
}
