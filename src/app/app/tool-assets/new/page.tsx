import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayInputValue } from "@/lib/business-date";

export default async function NewToolAssetPage() {
  const session = await requireSession();
  const printers = await db.printer.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { code: "asc" } });
  return <FormShell title="新增生产工具设备" description="记录工具、支架、检测设备等资产，并按使用年限自动计算月折旧成本。" action="/api/tool-assets" backHref="/app/tool-assets">
    <Field label="资产编码" name="code" required /><Field label="名称" name="name" required /><SelectField label="分类" name="category" required options={["工具", "支架", "检测设备", "后处理设备", "安全设备", "其他"].map(value => ({ value, label: value }))} /><Field label="数量" name="quantity" type="number" step="0.001" defaultValue="1" required /><Field label="购置金额" name="purchaseAmount" type="number" step="0.01" required /><Field label="购置日期" name="purchaseDate" type="date" defaultValue={todayInputValue()} required /><Field label="预计使用月数" name="usefulLifeMonths" type="number" defaultValue="36" required /><SelectField label="配套打印机（可选）" name="assignedPrinterId" options={printers.map(item => ({ value: item.id, label: `${item.code} · ${item.name}` }))} /><Field label="备注" name="remark" />
  </FormShell>;
}
