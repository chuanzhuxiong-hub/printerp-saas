import { Prisma, PrinterStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { nextMaintenanceDate } from "@/lib/printer-maintenance";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const printerId = text(form, "printerId");
  const performedAt = text(form, "performedAt") ? new Date(`${text(form, "performedAt")}T12:00:00`) : new Date();
  const cost = new Prisma.Decimal(decimalText(form, "cost"));

  await db.$transaction(async (tx) => {
    const printer = await tx.printer.findFirstOrThrow({
      where: { id: printerId, tenantId: session.tenantId, deletedAt: null }
    });
    const runtime = await tx.productionOrder.aggregate({
      where: { tenantId: session.tenantId, printerId: printer.id, deletedAt: null },
      _sum: { actualPrintHours: true }
    });
    const totalRuntimeHours = runtime._sum.actualPrintHours ?? new Prisma.Decimal(0);
    const record = await tx.printerMaintenanceRecord.create({
      data: {
        tenantId: session.tenantId,
        printerId: printer.id,
        maintenanceType: text(form, "maintenanceType") || "例行保养",
        performedAt,
        runtimeHoursAtService: totalRuntimeHours,
        cost,
        operatorName: text(form, "operatorName") || null,
        details: text(form, "details") || null,
        createdBy: session.userId
      }
    });
    await tx.printer.update({
      where: { id: printer.id },
      data: {
        lastMaintenanceAt: performedAt,
        nextMaintenanceAt: nextMaintenanceDate(performedAt, printer.maintenanceIntervalDays),
        lastMaintenanceHours: totalRuntimeHours,
        status: printer.status === PrinterStatus.MAINTENANCE ? PrinterStatus.IDLE : printer.status,
        updatedBy: session.userId
      }
    });
    if (cost.gt(0)) {
      await tx.costRecord.create({
        data: {
          tenantId: session.tenantId,
          sourceType: "PrinterMaintenance",
          sourceId: record.id,
          printerId: printer.id,
          amount: cost,
          remark: record.maintenanceType,
          createdBy: session.userId
        }
      });
    }
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "printer.maintenance.completed",
        entityType: "PrinterMaintenanceRecord",
        entityId: record.id,
        metadata: { printerId: printer.id, runtimeHours: totalRuntimeHours.toString(), cost: cost.toString() }
      }
    });
  });
  return NextResponse.redirect(new URL("/app/printer-maintenance?completed=1", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("printer-maintenance.post", handlePost);
