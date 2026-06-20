import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayInputValue } from "@/lib/business-date";

export default async function ReplacePrinterPartPage() {
  const session = await requireSession();
  const [parts, printers] = await Promise.all([db.printerPart.findMany({ where: { tenantId: session.tenantId, deletedAt: null, quantity: { gt: 0 } }, orderBy: { name: "asc" } }), db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { code: "asc" } })]);
  return <FormShell title="记录配件更换" description="更换后扣减配件库存，并将配件与人工成本计入对应打印机维护成本。" action="/api/printer-parts" backHref="/app/printer-parts">
    <input type="hidden" name="action" value="replace" /><SelectField label="打印机" name="printerId" required options={printers.map(item => ({ value: item.id, label: `${item.code} · ${item.name}` }))} /><SelectField label="更换配件" name="partId" required options={parts.map(item => ({ value: item.id, label: `${item.code} · ${item.name}（库存 ${item.quantity}）` }))} /><Field label="更换数量" name="quantity" type="number" step="0.001" defaultValue="1" required /><Field label="人工 / 其他费用" name="laborCost" type="number" step="0.01" defaultValue="0" /><Field label="更换日期" name="occurredAt" type="date" defaultValue={todayInputValue()} required /><Field label="维护人员" name="operatorName" /><Field label="损坏原因 / 备注" name="remark" />
  </FormShell>;
}

