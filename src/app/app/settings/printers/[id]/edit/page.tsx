import { notFound } from "next/navigation";
import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditPrinterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const item = await db.printer.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } }); if (!item) notFound();
  return <FormShell title="编辑打印机" description="修改设备成本、折旧、维护周期和状态。" action={`/api/printers/${item.id}`} backHref="/app/settings/printers"><Field label="打印机编号" name="code" required defaultValue={item.code} /><Field label="打印机名称" name="name" required defaultValue={item.name} /><Field label="型号" name="model" defaultValue={item.model ?? ""} /><Field label="购买价格" name="purchasePrice" type="number" step="0.01" defaultValue={item.purchasePrice.toString()} /><Field label="预计可用小时数" name="availableHours" type="number" step="0.01" defaultValue={item.availableHours.toString()} /><Field label="每小时折旧成本" name="depreciationPerHour" type="number" step="0.0001" defaultValue={item.depreciationPerHour.toString()} /><Field label="维护周期（天，0 表示关闭）" name="maintenanceIntervalDays" type="number" defaultValue={item.maintenanceIntervalDays.toString()} /><Field label="维护周期（打印小时，0 表示关闭）" name="maintenanceIntervalHours" type="number" step="0.01" defaultValue={item.maintenanceIntervalHours.toString()} /><SelectField label="状态" name="status" required defaultValue={item.status} options={[{ value: "IDLE", label: "空闲" }, { value: "PRINTING", label: "打印中" }, { value: "MAINTENANCE", label: "维护中" }, { value: "DISABLED", label: "停用" }]} /><Field label="备注" name="remark" defaultValue={item.remark ?? ""} /></FormShell>;
}
