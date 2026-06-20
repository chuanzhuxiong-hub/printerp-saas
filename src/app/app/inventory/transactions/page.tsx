import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function InventoryTransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory Ledger"
        title="库存流水"
        description="库存流水已统一集成到库存中心。采购、生产、发货、售后补发和库存调整都应通过库存流水追溯，不建议直接修改库存数量。"
      >
        <Link href="/app/inventory?tab=TRANSACTIONS" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">进入库存中心流水 Tab</Link>
      </PageHeader>
      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm leading-6 text-slate-700">
        为了保持库存口径统一，库存流水现在作为库存中心的一个 Tab 展示。原路由保留用于兼容历史链接。
      </section>
    </div>
  );
}
