import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const categoryName = `商业回归-${stamp}`;
const expenseName = `商业回归费用-${stamp}`;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  if (response.status !== 303) throw new Error(`登录失败 (${response.status})`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(cookie, path, values) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { cookie }, body: new URLSearchParams(values), redirect: "manual" });
  if (response.status !== 303) throw new Error(`${path} 提交失败 (${response.status}): ${await response.text()}`);
}

const tenant = await db.tenant.findFirstOrThrow();
const item = await db.inventoryItem.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null } });
const originalQuantity = item.quantity;

try {
  const cookie = await login();
  await post(cookie, "/api/expenses", { categoryName, name: expenseName, amount: "88.50", occurredAt: "2026-06-10", remark: "自动回归，完成后清理" });
  const expense = await db.expense.findFirstOrThrow({ where: { tenantId: tenant.id, name: expenseName } });
  const expenseCost = await db.costRecord.findFirst({ where: { sourceType: "Expense", sourceId: expense.id } });
  if (!expenseCost?.amount.equals("88.50")) throw new Error("经营费用未写入成本追溯");

  const barcode = `${item.category}:${item.refId}`;
  await post(cookie, "/api/inventory/scan", { barcode, direction: "IN", quantity: "1", remark: "商业回归" });
  await post(cookie, "/api/inventory/scan", { barcode, direction: "OUT", quantity: "1", remark: "商业回归" });
  const restored = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  if (!restored.quantity.equals(originalQuantity)) throw new Error("扫码入出库配对后库存未恢复");

  const exportResponse = await fetch(`${baseUrl}/api/exports?resource=orders`, { headers: { cookie } });
  if (exportResponse.status !== 200 || !exportResponse.headers.get("content-disposition")?.includes("printerp-orders")) throw new Error("订单 CSV 导出不可用");
  const exportBytes = new Uint8Array(await exportResponse.arrayBuffer());
  if (exportBytes[0] !== 0xef || exportBytes[1] !== 0xbb || exportBytes[2] !== 0xbf) throw new Error("CSV 导出缺少 Excel UTF-8 BOM");

  const health = await fetch(`${baseUrl}/api/health`);
  if (health.status !== 200 || (await health.json()).status !== "ok") throw new Error("健康检查不可用");
  if (health.headers.get("x-content-type-options") !== "nosniff" || health.headers.get("x-frame-options") !== "DENY") throw new Error("安全响应头未生效");
  console.log("Commercial integration passed: expense, barcode, export, health, security headers");
} finally {
  const expense = await db.expense.findFirst({ where: { tenantId: tenant.id, name: expenseName } });
  if (expense) {
    await db.costRecord.deleteMany({ where: { sourceType: "Expense", sourceId: expense.id } });
    await db.auditLog.deleteMany({ where: { tenantId: tenant.id, action: "expense.created", entityId: expense.id } });
    await db.expense.delete({ where: { id: expense.id } });
  }
  await db.expenseCategory.deleteMany({ where: { tenantId: tenant.id, name: categoryName } });
  const scans = await db.inventoryTransaction.findMany({ where: { tenantId: tenant.id, sourceType: "BarcodeScan", remark: "商业回归" }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { tenantId: tenant.id, action: "inventory.barcode-scanned", entityId: { in: scans.map(row => row.id) } } });
  await db.inventoryTransaction.deleteMany({ where: { id: { in: scans.map(row => row.id) } } });
  await db.inventoryItem.update({ where: { id: item.id }, data: { quantity: originalQuantity } });
  await db.$disconnect();
}
