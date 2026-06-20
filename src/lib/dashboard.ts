import { db } from "@/lib/db";

type DashboardData = {
  sales: string;
  orders: number;
  grossProfit: string;
  netProfit: string;
  afterSaleCost: string;
  shippingCost: string;
  productionCount: number;
  shippedCount: number;
  failedCount: number;
  lowStock: number;
  pendingProduction: number;
  pendingShipping: number;
  competitorAlerts: number;
};

const dashboardCache = new Map<string, { expiresAt: number; data: DashboardData }>();
const DASHBOARD_TTL_MS = 60_000;

export async function getDashboard(tenantId: string) {
  const cached = dashboardCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.data };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [orders, productionCount, shippedCount, failedCount, lowStock, pendingProduction, pendingShipping, competitorAlerts] =
    await Promise.all([
      db.salesOrder.aggregate({
        where: { tenantId, orderedAt: { gte: start, lt: end }, deletedAt: null },
        _sum: {
          receivedAmount: true,
          grossProfit: true,
          netProfit: true,
          afterSaleCost: true,
          shippingCost: true
        },
        _count: true
      }),
      db.productionOrder.aggregate({
        where: { tenantId, createdAt: { gte: start, lt: end }, deletedAt: null },
        _sum: { completedQuantity: true }
      }),
      db.shipment.count({ where: { tenantId, shippedAt: { gte: start, lt: end }, deletedAt: null } }),
      db.printFailure.aggregate({
        where: { tenantId, createdAt: { gte: start, lt: end } },
        _sum: { quantity: true }
      }),
      db.inventoryItem.count({
        where: { tenantId, deletedAt: null, quantity: { lte: db.inventoryItem.fields.warningStock } }
      }),
      db.productionOrder.count({ where: { tenantId, status: "PENDING", deletedAt: null } }),
      db.salesOrder.count({ where: { tenantId, status: "SHIPPING_PENDING", deletedAt: null } }),
      db.competitorAlert.count({ where: { tenantId, status: "UNREAD" } })
    ]);

  const data: DashboardData = {
    sales: orders._sum.receivedAmount?.toString() ?? "0",
    orders: orders._count,
    grossProfit: orders._sum.grossProfit?.toString() ?? "0",
    netProfit: orders._sum.netProfit?.toString() ?? "0",
    afterSaleCost: orders._sum.afterSaleCost?.toString() ?? "0",
    shippingCost: orders._sum.shippingCost?.toString() ?? "0",
    productionCount: productionCount._sum.completedQuantity ?? 0,
    shippedCount,
    failedCount: failedCount._sum.quantity ?? 0,
    lowStock,
    pendingProduction,
    pendingShipping,
    competitorAlerts
  };
  dashboardCache.set(tenantId, { expiresAt: Date.now() + DASHBOARD_TTL_MS, data });
  return { ...data };
}
