import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";

export default async function NewShopPage() {
  await requireSession();
  return <FormShell title="新增店铺" description="建立销售来源，后续订单和利润将按店铺汇总。" action="/api/shops" backHref="/app/settings/shops">
    <Field label="店铺名称" name="name" required />
    <Field label="联系人" name="contactName" />
    <Field label="备注" name="remark" />
  </FormShell>;
}
