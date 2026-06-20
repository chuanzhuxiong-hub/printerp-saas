import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function PrinterEfficiencyPage() {
  const session = await requireSession();
  const printers = await db.printer.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    include: { productionOrders: { where: { tenantId: session.tenantId, deletedAt: null } }, maintenanceRecords: true }
  });
  return <main>
    <PageHeader title="打印机效率分析" description="按打印机统计产量、利用率、失败率、折旧与维护成本。" />
    <DataTable headers={["打印机", "任务", "完成", "打印小时", "利用率", "失败率", "折旧成本", "维护成本", "总设备成本"]} rows={printers.map(printer => {
      const completed = printer.productionOrders.reduce((sum, item) => sum + item.completedQuantity, 0);
      const failed = printer.productionOrders.reduce((sum, item) => sum + item.failedQuantity, 0);
      const hours = printer.productionOrders.reduce((sum, item) => sum.plus(item.actualPrintHours), new Prisma.Decimal(0));
      const depreciation = hours.mul(printer.depreciationPerHour);
      const maintenance = printer.maintenanceRecords.reduce((sum, item) => sum.plus(item.cost), new Prisma.Decimal(0));
      const utilization = printer.availableHours.gt(0) ? hours.div(printer.availableHours).mul(100) : new Prisma.Decimal(0);
      return [`${printer.code} · ${printer.name}`, printer.productionOrders.length, completed, hours.toString(), `${utilization.toFixed(2)}%`, `${completed + failed ? (failed / (completed + failed) * 100).toFixed(2) : "0.00"}%`, depreciation.toFixed(2), maintenance.toFixed(2), depreciation.plus(maintenance).toFixed(2)];
    })} />
  </main>;
}
