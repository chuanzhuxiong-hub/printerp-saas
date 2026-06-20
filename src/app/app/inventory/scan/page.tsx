import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { inventoryBarcode } from "@/lib/barcode";

export default async function InventoryScanPage({ searchParams }: { searchParams: Promise<{ success?: string; item?: string; direction?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const items = await db.inventoryItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return <main>
    <PageHeader title="扫码入库 / 出库" description="扫描库存条码后快速增减库存；所有操作生成库存流水与审计日志。" />
    {query.success && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{query.item} 扫码{query.direction === "OUT" ? "出库" : "入库"}成功。</p>}
    <form action="/api/inventory/scan" method="post" className="mt-6 max-w-2xl space-y-5 rounded-xl border bg-white p-6 shadow-soft">
      <label className="block text-sm font-medium">库存条码
        <input autoFocus name="barcode" required placeholder="扫描或输入 MATERIAL:refId / PACKAGING:refId / PRODUCT:refId" className="mt-1 w-full rounded-lg border px-3 py-3 text-lg" />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">操作方向<select name="direction" className="mt-1 w-full rounded-lg border px-3 py-2.5"><option value="IN">入库</option><option value="OUT">出库</option></select></label>
        <label className="block text-sm font-medium">数量<input name="quantity" type="number" step="0.001" defaultValue="1" required className="mt-1 w-full rounded-lg border px-3 py-2.5" /></label>
      </div>
      <label className="block text-sm font-medium">备注<input name="remark" defaultValue="扫码入出库" className="mt-1 w-full rounded-lg border px-3 py-2.5" /></label>
      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">确认库存变更</button>
    </form>
    <h2 className="mt-8 text-lg font-semibold">库存条码参考</h2>
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(item => <div key={item.id} className="rounded-lg border bg-white p-3 text-sm"><p className="font-semibold">{item.name}</p><p className="mt-1 break-all font-mono text-xs text-muted">{inventoryBarcode(item.category, item.refId)}</p></div>)}</div>
  </main>;
}
