import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";

export default async function NewPrinterPage() {
  await requireSession();
  return <FormShell title="新增打印机" description="设备折旧成本将计入产品与生产任务成本。" action="/api/printers" backHref="/app/settings/printers">
    <Field label="打印机编号" name="code" required />
    <Field label="打印机名称" name="name" required />
    <Field label="型号" name="model" />
    <Field label="购买价格" name="purchasePrice" type="number" step="0.01" defaultValue="0" />
    <Field label="预计可用小时数" name="availableHours" type="number" step="0.01" defaultValue="0" />
    <Field label="每小时折旧成本" name="depreciationPerHour" type="number" step="0.0001" defaultValue="0" />
    <Field label="维护周期（天，0 表示关闭）" name="maintenanceIntervalDays" type="number" defaultValue="90" />
    <Field label="维护周期（打印小时，0 表示关闭）" name="maintenanceIntervalHours" type="number" step="0.01" defaultValue="500" />
  </FormShell>;
}
