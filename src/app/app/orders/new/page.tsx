import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [shops, skus] = await Promise.all([
    db.shop.findMany({ where: { tenantId: session.tenantId, deletedAt: null, isActive: true }, orderBy: { name: "asc" } }),
    db.productSku.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  return <FormShell title="手工录入订单" description="保存时自动计算订单毛利和净利。" action="/api/orders" backHref="/app/orders" error={query.error === "duplicate" ? "订单号已存在，请使用新的订单号。" : undefined}>
    <Field label="订单号" name="orderNo" required defaultValue={`SO-${Date.now()}`} />
    <SelectField label="店铺" name="shopId" options={shops.map(item => ({ value: item.id, label: item.name }))} />
    <SelectField label="SKU" name="skuId" required options={skus.map(item => ({ value: item.id, label: `${item.skuCode} · ${item.name}` }))} />
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="数量" name="quantity" type="number" defaultValue="1" required />
      <Field label="商品单价" name="unitPrice" type="number" step="0.01" required />
      <Field label="实收金额" name="receivedAmount" type="number" step="0.01" required />
      <Field label="产品成本" name="productCost" type="number" step="0.01" defaultValue="0" />
      <Field label="快递成本" name="shippingCost" type="number" step="0.01" defaultValue="0" />
      <Field label="包装成本" name="packagingCost" type="number" step="0.01" defaultValue="0" />
      <Field label="平台佣金" name="platformFee" type="number" step="0.01" defaultValue="0" />
      <Field label="支付手续费" name="paymentFee" type="number" step="0.01" defaultValue="0" />
      <Field label="广告成本" name="adCost" type="number" step="0.01" defaultValue="0" />
    </div>
    <Field label="客户名称" name="customerName" />
    <Field label="客户地区" name="customerRegion" />
  </FormShell>;
}
