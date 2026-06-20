import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayInputValue } from "@/lib/business-date";

export default async function PurchasePrinterPartPage() {
  const session = await requireSession();
  const parts = await db.printerPart.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  return <FormShell title="配件采购入库" description="采购配件先进入备件库存，尚未更换前不计入设备损耗成本。" action="/api/printer-parts" backHref="/app/printer-parts">
    <input type="hidden" name="action" value="purchase" /><SelectField label="配件" name="partId" required options={parts.map(item => ({ value: item.id, label: `${item.code} · ${item.name}` }))} /><Field label="采购数量" name="quantity" type="number" step="0.001" required /><Field label="采购总金额" name="amount" type="number" step="0.01" required /><Field label="采购日期" name="occurredAt" type="date" defaultValue={todayInputValue()} required /><Field label="备注" name="remark" />
  </FormShell>;
}

