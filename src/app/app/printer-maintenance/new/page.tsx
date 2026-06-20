import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewPrinterMaintenancePage({ searchParams }: { searchParams: Promise<{ printerId?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const printers = await db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { code: "asc" } });
  return <FormShell title="记录打印机维护" description="完成维护后会重置日期与运行小时提醒，并记录维护费用。" action="/api/printer-maintenance" backHref="/app/printer-maintenance">
    <SelectField label="打印机" name="printerId" required defaultValue={query.printerId} options={printers.map(item => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
    <SelectField label="维护类型" name="maintenanceType" required options={[
      { value: "例行保养", label: "例行保养" }, { value: "喷嘴更换", label: "喷嘴更换" }, { value: "皮带检查", label: "皮带检查" },
      { value: "润滑清洁", label: "润滑清洁" }, { value: "故障维修", label: "故障维修" }, { value: "其他", label: "其他" }
    ]} />
    <Field label="维护日期" name="performedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
    <Field label="维护人员" name="operatorName" />
    <Field label="维护费用" name="cost" type="number" step="0.01" defaultValue="0" />
    <Field label="维护内容 / 更换部件" name="details" />
  </FormShell>;
}
