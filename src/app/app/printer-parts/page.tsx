import Link from "next/link";
import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function PrinterPartsPage({ searchParams }: { searchParams: Promise<{ created?: string; purchased?: string; replaced?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [parts, rows] = await Promise.all([
    db.printerPart.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } }),
    db.printerPartTransaction.findMany({ where: { tenantId: session.tenantId }, include: { part: true, printer: true }, orderBy: { occurredAt: "desc" }, take: 100 })
  ]);
  const value = parts.reduce((sum, part) => sum.plus(part.quantity.mul(part.unitCost)), new Prisma.Decimal(0));
  return <main>
    <PageHeader title="打印机配件管理" description={`共 ${parts.length} 种配件，库存价值 ${value.toFixed(2)}；配件实际更换时计入打印机维护成本。`} actionHref="/app/printer-parts/new" actionLabel="新增配件" />
    {(query.created || query.purchased || query.replaced) && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">配件操作已完成。</p>}
    <div className="mt-4 flex gap-3"><Link className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-muted" href="/app/printer-parts/purchase">配件采购入库</Link><Link className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-muted" href="/app/printer-parts/replace">记录配件更换</Link></div>
    <h2 className="mt-8 text-lg font-semibold">配件库存</h2>
    <DataTable headers={["编码", "配件", "适配型号", "库存", "警戒线", "单位成本", "库存价值"]} rows={parts.map(part => [part.code, part.name, part.compatibleModel ?? "-", `${part.quantity} ${part.unit}`, part.warningStock.toString(), part.unitCost.toString(), part.quantity.mul(part.unitCost).toFixed(2)])} />
    <h2 className="mt-8 text-lg font-semibold">配件流水</h2>
    <DataTable headers={["日期", "配件", "类型", "数量", "打印机", "成本", "备注"]} rows={rows.map(row => [row.occurredAt.toLocaleDateString("zh-CN"), row.part.name, row.type, row.quantity.toString(), row.printer ? `${row.printer.code} · ${row.printer.name}` : "-", row.totalCost.toString(), row.remark ?? "-"])} />
  </main>;
}

