import { InventoryCategory, Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type InventoryTab = "ALL" | "MATERIAL" | "PRODUCT" | "PACKAGING" | "ALERTS" | "TRANSACTIONS";

const tabs: Array<{ key: InventoryTab; label: string; description: string }> = [
  { key: "ALL", label: "全部库存", description: "所有库存项目" },
  { key: "MATERIAL", label: "耗材库存", description: "PLA、PETG、ABS、TPU 等耗材" },
  { key: "PRODUCT", label: "成品库存", description: "SKU 成品库存和锁定库存" },
  { key: "PACKAGING", label: "包装库存", description: "纸箱、气泡袋、标签等包装" },
  { key: "ALERTS", label: "库存预警", description: "低库存、库存不足和警戒线" },
  { key: "TRANSACTIONS", label: "库存流水", description: "所有库存变更来源追溯" }
];

function activeTab(value?: string): InventoryTab {
  return tabs.some((tab) => tab.key === value) ? value as InventoryTab : "ALL";
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = { MATERIAL: "耗材", PRODUCT: "成品", PACKAGING: "包装", PART: "配件" };
  return labels[category] ?? category;
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    PURCHASE_IN: "采购入库",
    PRODUCTION_CONSUME: "生产消耗",
    PRODUCTION_IN: "生产入库",
    SALES_OUT: "销售出库",
    AFTERSALE_RESEND_OUT: "售后补发出库",
    RETURN_IN: "退货入库",
    STOCK_GAIN: "盘盈",
    STOCK_LOSS: "盘亏",
    SCRAP: "报废",
    MANUAL_ADJUST: "手工调整"
  };
  return labels[type] ?? type;
}

function quantity(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value).toFixed(3);
}

function money(value: Prisma.Decimal | number | string) {
  return `¥${new Prisma.Decimal(value).toFixed(4)}`;
}

function isLowStock(item: { quantity: Prisma.Decimal; warningStock: Prisma.Decimal }) {
  return item.quantity.lte(item.warningStock);
}

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; keyword?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const tab = activeTab(query.tab);
  const keyword = query.keyword?.trim();

  const baseWhere: Prisma.InventoryItemWhereInput = {
    tenantId: session.tenantId,
    deletedAt: null,
    name: keyword ? { contains: keyword, mode: "insensitive" } : undefined
  };
  const categoryWhere: Prisma.InventoryItemWhereInput = tab === "MATERIAL" || tab === "PRODUCT" || tab === "PACKAGING"
    ? { ...baseWhere, category: tab as InventoryCategory }
    : tab === "ALERTS"
      ? { ...baseWhere, quantity: { lte: db.inventoryItem.fields.warningStock } }
      : baseWhere;

  const [items, allItems, transactions] = await Promise.all([
    db.inventoryItem.findMany({ where: categoryWhere, orderBy: [{ category: "asc" }, { name: "asc" }], take: 300 }),
    db.inventoryItem.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.inventoryTransaction.findMany({ where: { tenantId: session.tenantId }, orderBy: { createdAt: "desc" }, take: 200 })
  ]);

  const lowStockItems = allItems.filter(isLowStock);
  const byCategory = new Map<string, number>();
  for (const item of allItems) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  const totalValue = allItems.reduce((sum, item) => sum.plus(item.quantity.mul(item.unitCost)), new Prisma.Decimal(0));

  const tabHref = (nextTab: InventoryTab) => `/app/inventory?tab=${nextTab}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="Inventory Operations"
        title="库存中心"
        description="统一管理耗材库存、成品库存、包装库存、库存流水和库存预警。所有库存数量变更必须统一走库存流水，避免直接手动改数量导致利润和成本不可追溯。"
        actionHref="/app/inventory/adjustments/new"
        actionLabel="库存调整"
      >
        <Link href="/app/inventory/scan" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">扫码出入库</Link>
        <Link href="/app/inventory/replenishment" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">补货建议</Link>
      </PageHeader>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="库存项目" value={allItems.length} description="耗材、成品、包装和配件" tone="brand" />
        <MetricCard title="库存预警" value={lowStockItems.length} description="低于或等于警戒线" tone={lowStockItems.length ? "danger" : "success"} />
        <MetricCard title="库存估值" value={`¥${totalValue.toFixed(2)}`} description="按当前数量 × 单位成本估算" />
        <MetricCard title="库存流水" value={transactions.length} description="最近 200 条库存变更" />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {tabs.map((item) => (
          <Link key={item.key} href={tabHref(item.key)} className={`rounded-2xl border p-4 shadow-sm transition ${tab === item.key ? "border-blue-200 bg-blue-50 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{item.label}</p>
              {item.key === "MATERIAL" && <StatusBadge tone="neutral">{byCategory.get("MATERIAL") ?? 0}</StatusBadge>}
              {item.key === "PRODUCT" && <StatusBadge tone="neutral">{byCategory.get("PRODUCT") ?? 0}</StatusBadge>}
              {item.key === "PACKAGING" && <StatusBadge tone="neutral">{byCategory.get("PACKAGING") ?? 0}</StatusBadge>}
              {item.key === "ALERTS" && <StatusBadge tone={lowStockItems.length ? "danger" : "success"}>{lowStockItems.length}</StatusBadge>}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
          </Link>
        ))}
      </div>

      <FilterBar>
        <form action="/app/inventory" method="get" className="flex w-full flex-wrap items-center gap-3">
          <input type="hidden" name="tab" value={tab} />
          <input name="keyword" defaultValue={keyword} placeholder="搜索库存名称" className="w-full rounded-lg border px-3 py-2 text-sm sm:min-w-[260px] sm:flex-1" />
          <button className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white sm:w-auto">筛选</button>
          <Link href="/app/inventory" className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">重置</Link>
        </form>
      </FilterBar>

      {tab !== "TRANSACTIONS" && (
        <DataTable
          headers={["类型", "名称", "当前库存", "锁定库存", "可用库存", "警戒线", "单位成本", "库存状态"]}
          rows={items.map((item) => {
            const low = isLowStock(item);
            return [
              <StatusBadge key={`${item.id}-category`} tone="info">{categoryLabel(item.category)}</StatusBadge>,
              item.name,
              quantity(item.quantity),
              quantity(item.lockedQuantity),
              quantity(item.quantity.minus(item.lockedQuantity)),
              quantity(item.warningStock),
              money(item.unitCost),
              <StatusBadge key={`${item.id}-status`} tone={low ? "danger" : "success"}>{low ? "低库存" : "库存正常"}</StatusBadge>
            ];
          })}
          emptyText="暂无库存项目"
          emptyDescription="采购入库、生产完成入库或初始化数据后，这里会显示库存。"
          alignRightColumns={[2, 3, 4, 5, 6]}
        />
      )}

      {tab === "TRANSACTIONS" && (
        <DataTable
          headers={["时间", "流水类型", "库存类别", "数量", "单位成本", "总成本", "来源", "备注"]}
          rows={transactions.map((item) => [
            item.createdAt.toLocaleString("zh-CN"),
            <StatusBadge key={`${item.id}-type`} tone="neutral">{transactionLabel(item.type)}</StatusBadge>,
            categoryLabel(item.category),
            quantity(item.quantity),
            money(item.unitCost),
            `¥${item.totalCost.toFixed(2)}`,
            `${item.sourceType ?? "-"} / ${item.sourceId ?? "-"}`,
            item.remark ?? "-"
          ])}
          emptyText="暂无库存流水"
          emptyDescription="采购、生产、发货、售后补发和库存调整都会生成库存流水。"
          alignRightColumns={[3, 4, 5]}
        />
      )}
    </div>
  );
}
