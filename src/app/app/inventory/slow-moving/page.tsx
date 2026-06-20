import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSlowInventory } from "@/lib/inventory-analysis";

export default async function SlowMovingPage() {
  const session = await requireSession();
  const from = new Date(Date.now() - 60 * 86400000);
  const [inventory, skus, recentItems, latestItems] = await Promise.all([
    db.inventoryItem.findMany({ where: { tenantId: session.tenantId, category: "PRODUCT", deletedAt: null } }),
    db.productSku.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, include: { product: true } }),
    db.salesOrderItem.findMany({ where: { tenantId: session.tenantId, salesOrder: { orderedAt: { gte: from }, deletedAt: null } }, select: { skuId: true, quantity: true } }),
    db.salesOrderItem.findMany({ where: { tenantId: session.tenantId, salesOrder: { deletedAt: null } }, include: { salesOrder: { select: { orderedAt: true } } }, orderBy: { salesOrder: { orderedAt: "desc" } } })
  ]);
  const sold = new Map<string, number>();
  for (const item of recentItems) if (item.skuId) sold.set(item.skuId, (sold.get(item.skuId) ?? 0) + item.quantity);
  const lastSold = new Map<string, Date>();
  for (const item of latestItems) if (item.skuId && !lastSold.has(item.skuId)) lastSold.set(item.skuId, item.salesOrder.orderedAt);
  const rows = skus.map(sku => {
    const stock = inventory.find(item => item.refId === sku.id);
    const state = isSlowInventory({ quantity: stock?.quantity ?? 0, soldLast60Days: sold.get(sku.id) ?? 0, lastSoldAt: lastSold.get(sku.id) ?? null });
    return { sku, stock, state, value: state.stockQuantity.mul(stock?.unitCost ?? 0) };
  }).filter(row => row.state.slow).sort((a, b) => b.value.minus(a.value).toNumber());

  return <main>
    <PageHeader title="滞销库存分析" description={`识别有成品库存但最近 60 天无销售的 SKU，共 ${rows.length} 项。`} />
    <DataTable headers={["SKU", "产品", "库存数量", "库存成本", "最后销售", "距今天数", "建议"]} rows={rows.map(row => [
      `${row.sku.skuCode} · ${row.sku.name}`, row.sku.product.name, row.state.stockQuantity.toString(), row.value.toFixed(2),
      row.state.daysSinceSale === null ? "从未销售" : lastSold.get(row.sku.id)?.toLocaleDateString("zh-CN") ?? "-",
      row.state.daysSinceSale ?? "-", "暂停生产 / 促销清仓"
    ])} />
  </main>;
}
