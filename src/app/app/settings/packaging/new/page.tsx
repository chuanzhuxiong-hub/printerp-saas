import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";

export default async function NewPackagingPage() {
  await requireSession();
  return <FormShell title="新增包装材料" description="维护包装材料单位成本和库存警戒线。" action="/api/packaging" backHref="/app/settings/packaging">
    <Field label="名称" name="name" required />
    <Field label="规格" name="spec" />
    <Field label="单位" name="unit" required placeholder="个 / 米 / 张" />
    <Field label="单价" name="unitPrice" type="number" step="0.0001" defaultValue="0" />
    <Field label="库存警戒线" name="warningStock" type="number" step="0.001" defaultValue="0" />
  </FormShell>;
}
