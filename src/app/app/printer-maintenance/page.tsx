import { Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMaintenanceState } from "@/lib/printer-maintenance";

export default async function PrinterMaintenancePage({ searchParams }: { searchParams: Promise<{ completed?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [printers, records] = await Promise.all([
    db.printer.findMany({
      where: { tenantId: session.tenantId, deletedAt: null },
      include: { productionOrders: { where: { tenantId: session.tenantId, deletedAt: null }, select: { actualPrintHours: true } } },
      orderBy: { code: "asc" }
    }),
    db.printerMaintenanceRecord.findMany({
      where: { tenantId: session.tenantId },
      include: { printer: true },
      orderBy: { performedAt: "desc" },
      take: 100
    })
  ]);
  const states = printers.map(printer => {
    const totalHours = printer.productionOrders.reduce((sum, row) => sum.plus(row.actualPrintHours), new Prisma.Decimal(0));
    const state = getMaintenanceState({
      totalRuntimeHours: totalHours.toNumber(),
      lastMaintenanceHours: printer.lastMaintenanceHours.toNumber(),
      maintenanceIntervalHours: printer.maintenanceIntervalHours.toNumber(),
      nextMaintenanceAt: printer.nextMaintenanceAt
    });
    return { printer, totalHours, state };
  });
  const dueCount = states.filter(item => item.state.due).length;

  return <main>
    <PageHeader title="打印机维护" description={`当前 ${dueCount} 台设备需要维护；提醒基于维护日期与累计打印小时。`} actionHref="/app/printer-maintenance/new" actionLabel="记录维护" />
    {query.completed && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">维护记录已保存，设备提醒周期已重新计算。</p>}
    <h2 className="mt-8 text-lg font-semibold">维护提醒</h2>
    <DataTable headers={["打印机", "状态", "累计小时", "维护后小时", "下次维护日期", "提醒", "操作"]} rows={states.map(({ printer, totalHours, state }) => [
      `${printer.code} · ${printer.name}`,
      printer.status,
      totalHours.toFixed(2),
      state.hoursSinceMaintenance.toFixed(2),
      printer.nextMaintenanceAt?.toLocaleDateString("zh-CN") ?? "未设置",
      state.due ? <span className="font-semibold text-red-600">{state.hoursDue && state.dateDue ? "日期与小时均到期" : state.hoursDue ? "运行小时到期" : "日期到期"}</span> : "正常",
      <Link className="font-semibold text-brand" href={`/app/printer-maintenance/new?printerId=${printer.id}`}>记录维护</Link>
    ])} />
    <h2 className="mt-8 text-lg font-semibold">维护历史</h2>
    <DataTable headers={["打印机", "类型", "维护日期", "当时累计小时", "费用", "维护人员", "内容"]} rows={records.map(record => [
      `${record.printer.code} · ${record.printer.name}`, record.maintenanceType, record.performedAt.toLocaleDateString("zh-CN"),
      record.runtimeHoursAtService.toString(), record.cost.toString(), record.operatorName ?? "-", record.details ?? "-"
    ])} />
  </main>;
}
