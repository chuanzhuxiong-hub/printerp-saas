import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CompleteProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [production, materials] = await Promise.all([
    db.productionOrder.findFirstOrThrow({ where: { id, tenantId: session.tenantId, deletedAt: null } }),
    db.material.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  return <FormShell title={`完工入库 · ${production.orderNo}`} description="提交后将扣减耗材、增加成品库存，并记录生产实际成本。" action={`/api/production/${id}/complete`} backHref="/app/production">
    <SelectField label="实际使用耗材" name="materialId" required options={materials.map(item => ({ value: item.id, label: `${item.type} · ${item.name}` }))} />
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="合格完成数量" name="completedQuantity" type="number" defaultValue={String(production.plannedQuantity)} required />
      <Field label="失败数量" name="failedQuantity" type="number" defaultValue="0" />
      <Field label="实际耗材克数" name="actualMaterialGrams" type="number" step="0.001" required />
      <Field label="实际打印小时" name="actualPrintHours" type="number" step="0.01" required />
    </div>
    <Field label="失败原因" name="failureReason" placeholder="无失败可留空" />
  </FormShell>;
}
