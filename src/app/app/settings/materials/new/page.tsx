import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewMaterialPage() {
  const session = await requireSession();
  const suppliers = await db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  return <FormShell title="新增耗材" description="维护材质、颜色、品牌和低库存警戒线。" action="/api/materials" backHref="/app/settings/materials">
    <Field label="耗材名称" name="name" required />
    <SelectField label="材质" name="type" required options={["PLA", "PETG", "ABS", "TPU", "OTHER"].map(value => ({ value, label: value }))} />
    <Field label="颜色" name="color" />
    <Field label="品牌" name="brand" />
    <SelectField label="默认供应商" name="defaultSupplierId" options={suppliers.map(item => ({ value: item.id, label: item.name }))} />
    <Field label="库存警戒线（克）" name="warningStock" type="number" step="0.001" defaultValue="0" />
  </FormShell>;
}
