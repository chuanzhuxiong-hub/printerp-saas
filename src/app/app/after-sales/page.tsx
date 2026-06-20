import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function AfterSalesPage() {
  const session = await requireSession();
  const [items, sum] = await Promise.all([
    db.afterSale.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, include: { salesOrder: true }, orderBy: { handledAt: "desc" }, take: 100 }),
    db.afterSale.aggregate({ where: { tenantId: session.tenantId, deletedAt: null }, _sum: { totalCost: true } })
  ]);
  return <main>
    <PageHeader title="售后管理" description={`共 ${items.length} 条售后记录，累计成本 ${sum._sum.totalCost?.toString() ?? "0"}。`} actionHref="/app/after-sales/new" actionLabel="新增售后" />
    <DataTable headers={["订单号", "售后类型", "原因", "退款", "补发成本", "平台处罚", "总成本", "订单当前净利"]} rows={items.map(item => [
      <Link className="font-semibold text-brand" href={`/app/orders/${item.salesOrder.id}`}>{item.salesOrder.orderNo}</Link>, item.type, item.reason ?? "-", item.refundAmount.toString(),
      item.resendProductCost.plus(item.resendShippingCost).plus(item.resendPackagingCost).toString(),
      item.platformPenalty.toString(), item.totalCost.toString(), item.salesOrder.netProfit.toString()
    ])} />
  </main>;
}
