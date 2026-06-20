import { PrinterStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { nextMaintenanceDate } from "@/lib/printer-maintenance";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  const form = await request.formData();
  const printer = await db.printer.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const maintenanceIntervalDays = Math.max(0, Number.parseInt(text(form, "maintenanceIntervalDays"), 10) || 0);
  const nextMaintenanceAt = maintenanceIntervalDays !== printer.maintenanceIntervalDays
    ? nextMaintenanceDate(printer.lastMaintenanceAt ?? new Date(), maintenanceIntervalDays)
    : printer.nextMaintenanceAt;
  const updated = await db.printer.update({ where: { id: printer.id }, data: { code: text(form, "code"), name: text(form, "name"), model: text(form, "model") || null, purchasePrice: decimalText(form, "purchasePrice"), availableHours: decimalText(form, "availableHours"), depreciationPerHour: decimalText(form, "depreciationPerHour"), maintenanceIntervalDays, maintenanceIntervalHours: decimalText(form, "maintenanceIntervalHours"), nextMaintenanceAt, status: text(form, "status") as PrinterStatus, remark: text(form, "remark") || null, updatedBy: auth.session.userId } });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "printer.updated", entityType: "Printer", entityId: updated.id, metadata: { status: updated.status } } });
  return NextResponse.redirect(new URL("/app/settings/printers", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("printers.by-id.post", handlePost);
