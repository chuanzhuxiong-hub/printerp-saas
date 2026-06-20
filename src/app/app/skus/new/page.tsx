import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewSkuPage() {
  const session = await requireSession();
  const products = await db.product.findMany({ where: { tenantId: session.tenantId, deletedAt: null, isActive: true }, orderBy: { name: "asc" } });
  return <FormShell title="新增 SKU" description="创建具体销售规格，并同步初始化成品库存主表。" action="/api/skus" backHref="/app/skus">
    <SelectField label="所属产品" name="productId" required options={products.map(item => ({ value: item.id, label: item.name }))} />
    <Field label="SKU 编码" name="skuCode" required placeholder="例如：POT-WHITE-L" />
    <Field label="SKU 名称" name="name" required />
    <div className="grid gap-4 md:grid-cols-3"><Field label="颜色" name="color" /><Field label="尺寸" name="size" /><Field label="材质" name="material" /></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="销售价格" name="salePrice" type="number" step="0.01" defaultValue="0" required /><Field label="成品库存警戒线" name="warningStock" type="number" step="0.001" defaultValue="0" /></div>
    <Field label="备注" name="remark" />
  </FormShell>;
}
