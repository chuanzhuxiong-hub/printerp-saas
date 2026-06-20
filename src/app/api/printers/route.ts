import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { nextMaintenanceDate } from "@/lib/printer-maintenance";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const maintenanceIntervalDays = Math.max(0, Number.parseInt(text(form, "maintenanceIntervalDays"), 10) || 0);
  const printer = await db.printer.create({
    data: {
      tenantId: auth.session.tenantId,
      code: text(form, "code"),
      name: text(form, "name"),
      model: text(form, "model") || null,
      purchasePrice: decimalText(form, "purchasePrice"),
      availableHours: decimalText(form, "availableHours"),
      depreciationPerHour: decimalText(form, "depreciationPerHour"),
      maintenanceIntervalDays,
      maintenanceIntervalHours: decimalText(form, "maintenanceIntervalHours"),
      nextMaintenanceAt: nextMaintenanceDate(new Date(), maintenanceIntervalDays),
      createdBy: auth.session.userId
    }
  });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "printer.created", entityType: "Printer", entityId: printer.id } });
  return NextResponse.redirect(new URL("/app/settings/printers", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("printers.post", handlePost);
