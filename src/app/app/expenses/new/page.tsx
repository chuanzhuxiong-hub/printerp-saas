import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

const defaults = ["房租", "人工工资", "水电", "设备折旧", "软件订阅", "办公用品", "仓储费用", "广告推广费", "其他费用"];

export default async function NewExpensePage() {
  const session = await requireSession();
  const categories = await db.expenseCategory.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  const names = [...new Set([...defaults, ...categories.map(item => item.name)])];
  return <FormShell title="记录经营费用" description="费用计入对应发生日期，并从经营净利润中扣除。" action="/api/expenses" backHref="/app/expenses">
    <SelectField label="费用分类" name="categoryName" required options={names.map(name => ({ value: name, label: name }))} />
    <Field label="费用名称" name="name" required />
    <Field label="金额" name="amount" type="number" step="0.01" required />
    <Field label="发生日期" name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
    <Field label="备注" name="remark" />
  </FormShell>;
}
