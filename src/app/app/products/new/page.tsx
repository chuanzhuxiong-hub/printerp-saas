import { Field, FormShell } from "@/components/form-shell";

export default function NewProductPage() {
  return <FormShell title="新增产品" description="创建产品 SPU，后续可在该产品下维护多个销售 SKU。" action="/api/products" backHref="/app/products">
    <Field label="产品名称" name="name" required />
    <Field label="产品分类" name="category" placeholder="例如：家居摆件" />
    <Field label="产品描述" name="description" />
  </FormShell>;
}
