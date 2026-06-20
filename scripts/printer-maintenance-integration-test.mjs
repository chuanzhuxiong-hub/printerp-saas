import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const startedAt = new Date();

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`登录失败 (${response.status})`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

const tenant = await db.tenant.findFirstOrThrow();
const printer = await db.printer.findFirstOrThrow({ where: { tenantId: tenant.id, deletedAt: null } });
const original = {
  status: printer.status,
  lastMaintenanceAt: printer.lastMaintenanceAt,
  nextMaintenanceAt: printer.nextMaintenanceAt,
  lastMaintenanceHours: printer.lastMaintenanceHours,
  updatedBy: printer.updatedBy
};

try {
  await db.printer.update({ where: { id: printer.id }, data: { status: "MAINTENANCE", maintenanceIntervalDays: 30 } });
  const cookie = await login();
  const form = new FormData();
  form.set("printerId", printer.id);
  form.set("maintenanceType", "集成测试维护");
  form.set("performedAt", "2026-06-10");
  form.set("operatorName", "Test");
  form.set("cost", "12.50");
  form.set("details", "自动测试，完成后清理");
  const response = await fetch(`${baseUrl}/api/printer-maintenance`, { method: "POST", headers: { cookie }, body: form, redirect: "manual" });
  if (response.status !== 303) throw new Error(`维护记录提交失败 (${response.status}): ${await response.text()}`);

  const [updated, record] = await Promise.all([
    db.printer.findUniqueOrThrow({ where: { id: printer.id } }),
    db.printerMaintenanceRecord.findFirstOrThrow({ where: { printerId: printer.id, maintenanceType: "集成测试维护" }, orderBy: { createdAt: "desc" } })
  ]);
  if (updated.status !== "IDLE") throw new Error(`维护完成后设备状态应为空闲，实际为 ${updated.status}`);
  if (updated.nextMaintenanceAt?.toISOString().slice(0, 10) !== "2026-07-10") throw new Error("下次维护日期未正确计算");
  const cost = await db.costRecord.findFirst({ where: { sourceType: "PrinterMaintenance", sourceId: record.id } });
  if (!cost?.amount.equals("12.50")) throw new Error("维护费用未写入成本追溯");
  console.log("Printer maintenance integration passed: record, reminder reset, status restore, cost trace");
} finally {
  const records = await db.printerMaintenanceRecord.findMany({ where: { printerId: printer.id, maintenanceType: "集成测试维护", createdAt: { gte: startedAt } }, select: { id: true } });
  await db.costRecord.deleteMany({ where: { sourceType: "PrinterMaintenance", sourceId: { in: records.map(item => item.id) } } });
  await db.auditLog.deleteMany({ where: { tenantId: tenant.id, action: "printer.maintenance.completed", createdAt: { gte: startedAt } } });
  await db.printerMaintenanceRecord.deleteMany({ where: { id: { in: records.map(item => item.id) } } });
  await db.printer.update({ where: { id: printer.id }, data: original });
  await db.$disconnect();
}
