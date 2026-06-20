import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewInventoryAdjustmentPage() {
  const session = await requireSession();
  const items = await db.inventoryItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return <FormShell title="库存调整" description="盘盈增加库存；盘亏和报废扣减库存。所有调整都会生成库存流水和审计日志。" action="/api/inventory/adjustments" backHref="/app/inventory">
    <SelectField label="库存项目" name="itemId" required options={items.map(item => ({ value: item.id, label: `${item.category} · ${item.name} · 当前 ${item.quantity}` }))} />
    <SelectField label="调整类型" name="type" required options={[{ value: "STOCK_GAIN", label: "盘盈" }, { value: "STOCK_LOSS", label: "盘亏" }, { value: "SCRAP", label: "报废" }]} />
    <Field label="调整数量" name="quantity" type="number" step="0.001" required />
    <Field label="备注" name="remark" required />
  </FormShell>;
}
