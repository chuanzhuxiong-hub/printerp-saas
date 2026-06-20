import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";

export default async function NewSupplierPage() {
  await requireSession();
  return <FormShell title="新增供应商" description="供应商将关联采购单和耗材批次成本。" action="/api/suppliers" backHref="/app/settings/suppliers">
    <Field label="供应商名称" name="name" required />
    <Field label="联系人" name="contact" />
    <Field label="电话" name="phone" />
    <Field label="备注" name="remark" />
  </FormShell>;
}
