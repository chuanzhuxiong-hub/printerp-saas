import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewPrinterPartPage() {
  const session = await requireSession();
  const suppliers = await db.supplier.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  return <FormShell title="新增打印机配件" description="建立喷嘴、热床、皮带、风扇、电机等备件档案。" action="/api/printer-parts" backHref="/app/printer-parts">
    <input type="hidden" name="action" value="create" /><Field label="配件编码" name="code" required /><Field label="配件名称" name="name" required /><Field label="适配打印机型号" name="compatibleModel" /><Field label="单位" name="unit" defaultValue="个" required /><Field label="库存警戒线" name="warningStock" type="number" step="0.001" defaultValue="0" /><SelectField label="默认供应商" name="supplierId" options={suppliers.map(item => ({ value: item.id, label: item.name }))} /><Field label="备注" name="remark" />
  </FormShell>;
}

