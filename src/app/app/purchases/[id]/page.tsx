import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PurchaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const query = await searchParams;
  const purchase = await db.purchaseOrder.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { items: true } }); if (!purchase) notFound();
  const [supplier, transactions, audits] = await Promise.all([
    purchase.supplierId ? db.supplier.findFirst({ where: { id: purchase.supplierId, tenantId: session.tenantId } }) : null,
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId, sourceType: "PurchaseOrder", sourceId: purchase.id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { tenantId: session.tenantId, entityId: purchase.id }, orderBy: { createdAt: "desc" } })
  ]);
  return <main><PageHeader title={`采购单 ${purchase.orderNo}`} description={`${supplier?.name ?? "未指定供应商"} · ${purchase.status} · ${purchase.purchaseDate.toLocaleString("zh-CN")}`} />
    {query.error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</p>}
    {purchase.status !== "CANCELLED" && <div className="mt-4 flex flex-wrap gap-3">
      <Link href={`/app/purchases/${purchase.id}/edit`} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">编辑采购单</Link>
      <form action={`/api/purchases/${purchase.id}`} method="post">
        <input type="hidden" name="action" value="cancel" />
        <button className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700">撤销采购单</button>
      </form>
    </div>}
    <div className="mt-6 grid gap-4 md:grid-cols-5">{[["采购金额", purchase.purchaseAmount], ["运费", purchase.shippingFee], ["税费", purchase.taxFee], ["优惠", purchase.discountAmount], ["入库总成本", purchase.totalCost]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-4 shadow-soft"><p className="text-sm text-muted">{String(label)}</p><p className="mt-2 text-xl font-bold">{value.toString()}</p></div>)}</div>
    <h2 className="mt-8 text-lg font-semibold">采购明细</h2><DataTable headers={["类别", "数量", "采购金额", "单位成本"]} rows={purchase.items.map(item => [item.category, item.quantity.toString(), item.amount.toString(), item.unitCost.toString()])} />
    <h2 className="mt-8 text-lg font-semibold">入库流水</h2><DataTable headers={["类别", "数量", "单位成本", "总成本", "时间"]} rows={transactions.map(item => [item.category, item.quantity.toString(), item.unitCost.toString(), item.totalCost.toString(), item.createdAt.toLocaleString("zh-CN")])} />
    <h2 className="mt-8 text-lg font-semibold">操作日志</h2><DataTable headers={["动作", "时间"]} rows={audits.map(item => [item.action, item.createdAt.toLocaleString("zh-CN")])} />
  </main>;
}
