import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DataManagementPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [orders, production, purchases, inventory, expenses, master] = await Promise.all([
    db.salesOrder.count({ where: { tenantId: session.tenantId } }),
    db.productionOrder.count({ where: { tenantId: session.tenantId } }),
    db.purchaseOrder.count({ where: { tenantId: session.tenantId } }),
    db.inventoryItem.count({ where: { tenantId: session.tenantId } }),
    db.expense.count({ where: { tenantId: session.tenantId } }),
    Promise.all([
      db.shop.count({ where: { tenantId: session.tenantId } }),
      db.product.count({ where: { tenantId: session.tenantId } }),
      db.productSku.count({ where: { tenantId: session.tenantId } }),
      db.material.count({ where: { tenantId: session.tenantId } }),
      db.packagingItem.count({ where: { tenantId: session.tenantId } }),
      db.printer.count({ where: { tenantId: session.tenantId } }),
      db.supplier.count({ where: { tenantId: session.tenantId } })
    ])
  ]);
  const masterCount = master.reduce((sum, count) => sum + count, 0);

  return <main className="max-w-5xl">
    <h1 className="text-2xl font-bold text-ink">数据管理与初始化</h1>
    <p className="mt-1 text-sm text-muted">仅商家老板可操作。初始化不会删除商家空间、登录账号、员工账号或订阅信息。</p>
    {query.success && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.success}</p>}
    {query.error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{query.error}</p>}

    <div className="mt-6 grid gap-4 md:grid-cols-3">
      {[["销售订单", orders], ["生产任务", production], ["采购单", purchases], ["库存项目", inventory], ["经营费用", expenses], ["基础资料", masterCount]].map(([label, value]) =>
        <div key={String(label)} className="rounded-xl border bg-white p-5 shadow-soft"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>
      )}
    </div>

    <section className="mt-8 rounded-xl border bg-white p-6 shadow-soft">
      <h2 className="text-lg font-bold">部分数据如何删除</h2>
      <div className="mt-4 grid gap-4 text-sm leading-7 md:grid-cols-2">
        <div className="rounded-lg bg-panel p-4"><p className="font-semibold">采购单录错</p><p className="text-muted">进入采购单详情，使用“编辑采购单”或“撤销采购单”。存在后续库存操作时系统会阻止撤销。</p></div>
        <div className="rounded-lg bg-panel p-4"><p className="font-semibold">基础资料不再使用</p><p className="text-muted">进入产品、SKU、店铺、供应商等编辑页面，将其停用。保留历史资料可以避免报表失去追溯依据。</p></div>
        <div className="rounded-lg bg-panel p-4"><p className="font-semibold">库存数量录错</p><p className="text-muted">使用库存调整生成修正流水，不直接删除库存或历史流水。</p></div>
        <div className="rounded-lg bg-panel p-4"><p className="font-semibold">大量测试数据</p><p className="text-muted">使用下方“清空经营数据”或“初始化全部业务数据”，操作前先导出并备份。</p></div>
      </div>
    </section>

    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <form action="/api/data-management" method="post" className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <input type="hidden" name="scope" value="OPERATIONS" />
        <h2 className="text-lg font-bold text-amber-950">清空经营数据</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">删除订单、生产、采购、库存、费用、维护、报表和历史审计日志；保留全部基础资料和 BOM，适合清除试运行数据后重新开始经营。</p>
        <label className="mt-5 block text-sm font-semibold text-amber-950">输入“清空经营数据”确认
          <input name="confirmation" required autoComplete="off" className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5" />
        </label>
        <button className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white">清空经营数据</button>
      </form>

      <form action="/api/data-management" method="post" className="rounded-xl border border-red-300 bg-red-50 p-6">
        <input type="hidden" name="scope" value="ALL" />
        <h2 className="text-lg font-bold text-red-950">初始化全部业务数据</h2>
        <p className="mt-2 text-sm leading-6 text-red-900">在清空经营数据基础上，继续删除店铺、产品、SKU、BOM、耗材、包装、打印机和供应商。账号与商家空间保留。</p>
        <label className="mt-5 block text-sm font-semibold text-red-950">输入“初始化全部数据”确认
          <input name="confirmation" required autoComplete="off" className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2.5" />
        </label>
        <button className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">初始化全部业务数据</button>
      </form>
    </div>
    <p className="mt-5 rounded-lg border bg-white px-4 py-3 text-sm text-muted">初始化不可撤销。执行前请先前往“数据导出”下载数据，并运行数据库备份。</p>
  </main>;
}

