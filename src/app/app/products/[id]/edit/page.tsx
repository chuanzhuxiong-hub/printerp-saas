import { notFound } from "next/navigation";
import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const product = await db.product.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } });
  if (!product) notFound();
  return <FormShell title="编辑产品" description="修改产品名称、分类和描述。" action={`/api/products/${product.id}`} backHref="/app/products">
    <Field label="产品名称" name="name" required defaultValue={product.name} />
    <Field label="产品分类" name="category" defaultValue={product.category ?? ""} />
    <Field label="产品描述" name="description" defaultValue={product.description ?? ""} />
  </FormShell>;
}
