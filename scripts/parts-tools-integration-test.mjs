import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const partCode = `PART-${stamp}`;
const assetCode = `TOOL-${stamp}`;
let part;
let asset;
let replacement;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
  if (response.status !== 303) throw new Error(`登录失败：${response.status}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function post(cookie, path, values) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { cookie }, body: new URLSearchParams(values), redirect: "manual" });
  if (response.status !== 303) throw new Error(`${path} 提交失败：${response.status} ${await response.text()}`);
}

try {
  const cookie = await login();
  await post(cookie, "/api/printer-parts", { action: "create", code: partCode, name: "自动化测试喷嘴", compatibleModel: "", unit: "个", warningStock: "1" });
  part = await db.printerPart.findFirstOrThrow({ where: { code: partCode } });
  const printer = await db.printer.findFirstOrThrow({ where: { tenantId: part.tenantId, deletedAt: null } });
  await post(cookie, "/api/printer-parts", { action: "purchase", partId: part.id, quantity: "10", amount: "100", occurredAt: "2026-06-01", remark: "自动化测试采购" });
  await post(cookie, "/api/printer-parts", { action: "replace", partId: part.id, printerId: printer.id, quantity: "2", laborCost: "5", occurredAt: "2026-06-02", operatorName: "自动测试", remark: "损坏更换" });

  const updatedPart = await db.printerPart.findUniqueOrThrow({ where: { id: part.id } });
  replacement = await db.printerPartTransaction.findFirstOrThrow({ where: { tenantId: part.tenantId, partId: part.id, type: "REPLACEMENT_OUT" } });
  const maintenance = await db.printerMaintenanceRecord.findFirstOrThrow({ where: { id: replacement.maintenanceRecordId } });
  const cost = await db.costRecord.findFirstOrThrow({ where: { sourceType: "PrinterPartReplacement", sourceId: replacement.id } });
  if (!updatedPart.quantity.equals(8) || !updatedPart.unitCost.equals(10)) throw new Error("配件库存或移动平均成本错误");
  if (!replacement.totalCost.equals(20) || !maintenance.cost.equals(25) || !cost.amount.equals(25)) throw new Error("配件更换成本未正确归集");

  await post(cookie, "/api/tool-assets", { code: assetCode, name: "自动化测试工具架", category: "支架", quantity: "1", purchaseAmount: "1200", purchaseDate: "2026-06-01", usefulLifeMonths: "24", assignedPrinterId: printer.id });
  asset = await db.toolAsset.findFirstOrThrow({ where: { tenantId: part.tenantId, code: assetCode } });
  if (!asset.monthlyDepreciation.equals(50)) throw new Error("工具设备月折旧计算错误");

  console.log("Parts/tools integration passed: inventory, replacement maintenance cost, cost trace and tool depreciation");
} finally {
  if (!asset) asset = await db.toolAsset.findFirst({ where: { code: assetCode } });
  if (asset) {
    await db.auditLog.deleteMany({ where: { entityType: "ToolAsset", entityId: asset.id } });
    await db.toolAsset.delete({ where: { id: asset.id } });
  }
  if (!part) part = await db.printerPart.findFirst({ where: { code: partCode } });
  if (part) {
    const rows = await db.printerPartTransaction.findMany({ where: { partId: part.id } });
    const maintenanceIds = rows.map(row => row.maintenanceRecordId).filter(Boolean);
    await db.costRecord.deleteMany({ where: { sourceType: "PrinterPartReplacement", sourceId: { in: rows.map(row => row.id) } } });
    await db.auditLog.deleteMany({ where: { entityType: "PrinterPartTransaction", entityId: { in: rows.map(row => row.id) } } });
    await db.inventoryTransaction.deleteMany({ where: { category: "PART", refId: part.id } });
    await db.inventoryItem.deleteMany({ where: { category: "PART", refId: part.id } });
    await db.printerPartTransaction.deleteMany({ where: { partId: part.id } });
    await db.printerMaintenanceRecord.deleteMany({ where: { id: { in: maintenanceIds } } });
    await db.printerPart.delete({ where: { id: part.id } });
  }
  await db.$disconnect();
}
