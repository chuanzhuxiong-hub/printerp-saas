import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type PeriodRow = {
  key: string;
  label: string;
  total: Prisma.Decimal;
  material: Prisma.Decimal;
  packaging: Prisma.Decimal;
  part: Prisma.Decimal;
  count: number;
  details: Map<string, Prisma.Decimal>;
};

type PurchaseEntry = {
  date: Date;
  category: "耗材" | "包装" | "配件";
  name: string;
  amount: Prisma.Decimal;
  sourceId: string;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date: Date) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

function periodInfo(date: Date, type: "day" | "week" | "month" | "year") {
  if (type === "day") return { key: dayKey(date), label: dayKey(date) };
  if (type === "week") {
    const start = weekKey(date);
    const end = new Date(`${start}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { key: start, label: `${start} 至 ${dayKey(end)}` };
  }
  if (type === "month") {
    const key = date.toISOString().slice(0, 7);
    return { key, label: key };
  }
  const key = String(date.getUTCFullYear());
  return { key, label: key };
}

function groupEntries(entries: PurchaseEntry[], type: "day" | "week" | "month" | "year") {
  const grouped = new Map<string, PeriodRow>();
  for (const entry of entries) {
    const period = periodInfo(entry.date, type);
    const row = grouped.get(period.key) ?? {
      ...period,
      total: new Prisma.Decimal(0),
      material: new Prisma.Decimal(0),
      packaging: new Prisma.Decimal(0),
      part: new Prisma.Decimal(0),
      count: 0,
      details: new Map<string, Prisma.Decimal>()
    };
    row.total = row.total.plus(entry.amount);
    if (entry.category === "耗材") row.material = row.material.plus(entry.amount);
    if (entry.category === "包装") row.packaging = row.packaging.plus(entry.amount);
    if (entry.category === "配件") row.part = row.part.plus(entry.amount);
    row.details.set(`${entry.category} · ${entry.name}`, (row.details.get(`${entry.category} · ${entry.name}`) ?? new Prisma.Decimal(0)).plus(entry.amount));
    row.count++;
    grouped.set(period.key, row);
  }
  return [...grouped.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function detailText(row: PeriodRow) {
  return [...row.details.entries()]
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .map(([name, amount]) => `${name}：${amount.toFixed(2)}`)
    .join("；");
}

function reportTable(title: string, rows: PeriodRow[], limit: number) {
  return <section className="mt-10">
    <h2 className="text-lg font-semibold">{title}</h2>
    <DataTable headers={["期间", "采购总金额", "耗材", "包装", "打印机配件", "采购项数", "各物料采购金额"]} rows={rows.slice(0, limit).map(row => [
      row.label, row.total.toFixed(2), row.material.toFixed(2), row.packaging.toFixed(2), row.part.toFixed(2), row.count, detailText(row)
    ])} />
  </section>;
}

export default async function PurchaseReportPage() {
  const session = await requireSession();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  from.setHours(0, 0, 0, 0);
  const [orders, materials, packagingItems, partRows] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { tenantId: session.tenantId, purchaseDate: { gte: from }, deletedAt: null, status: { not: "CANCELLED" } },
      include: { items: true },
      orderBy: { purchaseDate: "desc" }
    }),
    db.material.findMany({ where: { tenantId: session.tenantId }, select: { id: true, name: true } }),
    db.packagingItem.findMany({ where: { tenantId: session.tenantId }, select: { id: true, name: true } }),
    db.printerPartTransaction.findMany({
      where: { tenantId: session.tenantId, type: "PURCHASE_IN", occurredAt: { gte: from } },
      include: { part: true },
      orderBy: { occurredAt: "desc" }
    })
  ]);
  const materialNames = new Map(materials.map(item => [item.id, item.name]));
  const packagingNames = new Map(packagingItems.map(item => [item.id, item.name]));
  const entries: PurchaseEntry[] = [];

  for (const order of orders) {
    const itemAmount = order.items.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
    for (const item of order.items) {
      const category = item.category === "MATERIAL" ? "耗材" : "包装";
      const name = item.materialId ? materialNames.get(item.materialId) ?? "未知耗材" : item.packagingItemId ? packagingNames.get(item.packagingItemId) ?? "未知包装" : "未知物料";
      const amount = itemAmount.gt(0) ? order.totalCost.mul(item.amount).div(itemAmount) : order.totalCost.div(Math.max(order.items.length, 1));
      entries.push({ date: order.purchaseDate, category, name, amount, sourceId: order.id });
    }
  }
  for (const row of partRows) entries.push({ date: row.occurredAt, category: "配件", name: row.part.name, amount: row.totalCost, sourceId: row.id });

  const dayRows = groupEntries(entries, "day");
  const weekRows = groupEntries(entries, "week");
  const monthRows = groupEntries(entries, "month");
  const yearRows = groupEntries(entries, "year");
  const now = new Date();
  const currentRows = [
    ["今日", dayRows.find(row => row.key === periodInfo(now, "day").key)],
    ["本周", weekRows.find(row => row.key === periodInfo(now, "week").key)],
    ["本月", monthRows.find(row => row.key === periodInfo(now, "month").key)],
    ["本年", yearRows.find(row => row.key === periodInfo(now, "year").key)]
  ] as const;

  return <main>
    <PageHeader title="采购金额分析" description="按真实采购日期统计耗材、包装材料和打印机配件的采购总金额，采购附加费用按采购项金额比例分摊。" />
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {currentRows.map(([label, row]) => <section key={label} className="rounded-xl border bg-white p-5 shadow-soft">
        <h2 className="font-semibold">{label}采购</h2>
        <p className="mt-3 text-2xl font-bold text-brand">{row?.total.toFixed(2) ?? "0.00"}</p>
        <dl className="mt-4 space-y-2 text-sm text-muted">
          <div className="flex justify-between"><dt>耗材</dt><dd>{row?.material.toFixed(2) ?? "0.00"}</dd></div>
          <div className="flex justify-between"><dt>包装</dt><dd>{row?.packaging.toFixed(2) ?? "0.00"}</dd></div>
          <div className="flex justify-between"><dt>打印机配件</dt><dd>{row?.part.toFixed(2) ?? "0.00"}</dd></div>
        </dl>
      </section>)}
    </div>
    {reportTable("按日排列", dayRows, 366)}
    {reportTable("按周排列", weekRows, 104)}
    {reportTable("按月排列", monthRows, 60)}
    {reportTable("按年排列", yearRows, 20)}
  </main>;
}
