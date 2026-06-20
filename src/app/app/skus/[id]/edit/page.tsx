import { notFound } from "next/navigation";
import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditSkuPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [sku, products] = await Promise.all([
    db.productSku.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } }),
    db.product.findMany({ where: { tenantId: session.tenantId, deletedAt: null, isActive: true }, orderBy: { name: "asc" } })
  ]);
  if (!sku) notFound();
  return <FormShell title="编辑 SKU" description="修改销售规格、价格与成品库存警戒线。" action={`/api/skus/${sku.id}`} backHref="/app/skus">
    <SelectField label="所属产品" name="productId" required defaultValue={sku.productId} options={products.map(item => ({ value: item.id, label: item.name }))} />
    <Field label="SKU 编码" name="skuCode" required defaultValue={sku.skuCode} />
    <Field label="SKU 名称" name="name" required defaultValue={sku.name} />
    <div className="grid gap-4 md:grid-cols-3"><Field label="颜色" name="color" defaultValue={sku.color ?? ""} /><Field label="尺寸" name="size" defaultValue={sku.size ?? ""} /><Field label="材质" name="material" defaultValue={sku.material ?? ""} /></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="销售价格" name="salePrice" type="number" step="0.01" defaultValue={sku.salePrice.toString()} required /><Field label="成品库存警戒线" name="warningStock" type="number" step="0.001" defaultValue={sku.warningStock.toString()} /></div>
    <Field label="备注" name="remark" defaultValue={sku.remark ?? ""} />
  </FormShell>;
}
