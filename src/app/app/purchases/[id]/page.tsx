import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return `¥${new Prisma.Decimal(value ?? 0).toFixed(2)}`;
}

function quantity(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value).toFixed(3);
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "RECEIVED") return "success";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { DRAFT: "草稿", RECEIVED: "已入库", CANCELLED: "已撤销" };
  return labels[status] ?? status;
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = { MATERIAL: "耗材", PACKAGING: "包装", PART: "配件", PRODUCT: "成品" };
  return labels[category] ?? category;
}

export default async function PurchaseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const query = await searchParams;
  const purchase = await db.purchaseOrder.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null }, include: { items: true } });
  if (!purchase) notFound();

  const [supplier, transactions, audits] = await Promise.all([
    purchase.supplierId ? db.supplier.findFirst({ where: { id: purchase.supplierId, tenantId: session.tenantId } }) : null,
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId, sourceType: "PurchaseOrder", sourceId: purchase.id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { tenantId: session.tenantId, entityId: purchase.id }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="采购中心"
        title={`采购单 ${purchase.orderNo}`}
        description={`${supplier?.name ?? "未指定供应商"} · ${statusLabel(purchase.status)} · ${purchase.purchaseDate.toLocaleString("zh-CN")}`}
      />

      {query.error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.error}</p>}

      {purchase.status !== "CANCELLED" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <Link href={`/app/purchases/${purchase.id}/edit`} className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto">编辑采购单</Link>
          <form action={`/api/purchases/${purchase.id}`} method="post" className="w-full sm:w-auto">
            <input type="hidden" name="action" value="cancel" />
            <button className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 sm:w-auto">撤销采购单</button>
          </form>
          <StatusBadge tone={statusTone(purchase.status)}>{statusLabel(purchase.status)}</StatusBadge>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["采购金额", money(purchase.purchaseAmount)],
          ["运费", money(purchase.shippingFee)],
          ["税费", money(purchase.taxFee)],
          ["优惠", money(purchase.discountAmount)],
          ["入库总成本", money(purchase.totalCost)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">采购明细</h2>
        <DataTable
          headers={["类别", "数量", "采购金额", "单位成本"]}
          rows={purchase.items.map((item) => [categoryLabel(item.category), quantity(item.quantity), money(item.amount), money(item.unitCost)])}
          alignRightColumns={[1, 2, 3]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">入库流水</h2>
        <DataTable
          headers={["类别", "数量", "单位成本", "总成本", "时间"]}
          rows={transactions.map((item) => [categoryLabel(item.category), quantity(item.quantity), money(item.unitCost), money(item.totalCost), item.createdAt.toLocaleString("zh-CN")])}
          emptyText="暂无入库流水"
          alignRightColumns={[1, 2, 3]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">操作日志</h2>
        <DataTable headers={["动作", "时间"]} rows={audits.map((item) => [item.action, item.createdAt.toLocaleString("zh-CN")])} emptyText="暂无操作日志" />
      </section>
    </div>
  );
}
