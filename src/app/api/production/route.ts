import { ProductionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const orderNo = text(form, "orderNo");
  const duplicate = await db.productionOrder.findFirst({ where: { tenantId: session.tenantId, orderNo, deletedAt: null }, select: { id: true } });
  if (duplicate) return NextResponse.redirect(new URL("/app/production/new?error=duplicate", process.env.APP_URL ?? request.url), 303);
  const skuId = text(form, "skuId");
  const printerId = text(form, "printerId") || null;
  const salesOrderId = text(form, "salesOrderId") || null;

  await db.productSku.findFirstOrThrow({ where: { id: skuId, tenantId: session.tenantId, deletedAt: null } });
  if (salesOrderId) {
    await db.salesOrder.findFirstOrThrow({ where: { id: salesOrderId, tenantId: session.tenantId, deletedAt: null } });
  }
  if (printerId) {
    await db.printer.findFirstOrThrow({ where: { id: printerId, tenantId: session.tenantId, deletedAt: null } });
  }

  const production = await db.productionOrder.create({
    data: {
      tenantId: session.tenantId,
      orderNo,
      salesOrderId,
      skuId,
      printerId,
      plannedQuantity: Math.max(1, Number.parseInt(text(form, "plannedQuantity"), 10) || 1),
      status: ProductionStatus.PENDING,
      assigneeName: text(form, "assigneeName") || null,
      remark: text(form, "remark") || null,
      createdBy: session.userId,
      items: {
        create: [{
          tenantId: session.tenantId,
          skuId,
          plannedQuantity: Math.max(1, Number.parseInt(text(form, "plannedQuantity"), 10) || 1)
        }]
      }
    }
  });
  await db.auditLog.create({
    data: { tenantId: session.tenantId, userId: session.userId, action: "production.created", entityType: "ProductionOrder", entityId: production.id }
  });
  return NextResponse.redirect(new URL("/app/production", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("production.post", handlePost);
