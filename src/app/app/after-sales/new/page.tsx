import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

const types = [
  ["REFUND_ONLY", "退款不退货"], ["RETURN_REFUND", "退货退款"], ["RESEND_PRODUCT", "补发产品"],
  ["RESEND_PART", "补发配件"], ["WRONG_ITEM", "发错货"], ["MISSING_ITEM", "少发货"],
  ["DAMAGED", "产品破损"], ["QUALITY_ISSUE", "打印质量问题"], ["PLATFORM_PENALTY", "平台处罚"],
  ["COMPENSATION", "赔偿客户"]
];

export default async function NewAfterSalePage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const orders = await db.salesOrder.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    include: { items: { include: { sku: true } } },
    orderBy: { orderedAt: "desc" },
    take: 100
  });
  const skuOptions = orders.flatMap(order => order.items.flatMap(item => item.sku ? [{ value: item.sku.id, label: `${order.orderNo} · ${item.sku.skuCode} · ${item.sku.name}` }] : []));
  return <FormShell title="新增售后记录" description="补发类售后将按实际库存成本自动扣减成品和 BOM 包装，并重算订单净利润。" action="/api/after-sales" backHref={query.orderId ? `/app/orders/${query.orderId}` : "/app/after-sales"}>
    <SelectField label="销售订单" name="salesOrderId" required defaultValue={query.orderId} options={orders.map(item => ({ value: item.id, label: `${item.orderNo} · 当前净利 ${item.netProfit}` }))} />
    <SelectField label="售后类型" name="type" required options={types.map(([value, label]) => ({ value, label }))} />
    <Field label="售后原因" name="reason" />
    <div className="rounded-lg border bg-panel p-4">
      <p className="mb-3 text-sm font-semibold">补发库存</p>
      <SelectField label="补发订单内 SKU" name="resendSkuId" options={skuOptions} />
      <div className="mt-3"><Field label="补发数量" name="resendQuantity" type="number" defaultValue="0" /></div>
      <p className="mt-2 text-xs text-muted">补发产品成本和包装成本由库存移动平均成本自动计算，不再手工填写。</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="退款金额" name="refundAmount" type="number" step="0.01" defaultValue="0" />
      <Field label="补发快递成本" name="resendShippingCost" type="number" step="0.01" defaultValue="0" />
      <Field label="退货快递成本" name="returnShippingCost" type="number" step="0.01" defaultValue="0" />
      <Field label="报废成本" name="scrapCost" type="number" step="0.01" defaultValue="0" />
      <Field label="平台处罚" name="platformPenalty" type="number" step="0.01" defaultValue="0" />
      <Field label="人工处理成本" name="laborCost" type="number" step="0.01" defaultValue="0" />
    </div>
    <Field label="备注" name="remark" />
  </FormShell>;
}
