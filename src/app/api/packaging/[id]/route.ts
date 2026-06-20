import { InventoryCategory, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  const form = await request.formData();
  const item = await db.packagingItem.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const warningStock = new Prisma.Decimal(decimalText(form, "warningStock"));
  await db.$transaction(async (tx) => {
    const updated = await tx.packagingItem.update({ where: { id: item.id }, data: { name: text(form, "name"), spec: text(form, "spec") || null, unit: text(form, "unit"), warningStock, remark: text(form, "remark") || null, updatedBy: auth.session!.userId } });
    await tx.inventoryItem.updateMany({ where: { tenantId: auth.session!.tenantId, category: InventoryCategory.PACKAGING, refId: item.id }, data: { name: updated.name, warningStock, updatedBy: auth.session!.userId } });
    await tx.auditLog.create({ data: { tenantId: auth.session!.tenantId, userId: auth.session!.userId, action: "packaging.updated", entityType: "PackagingItem", entityId: updated.id } });
  });
  return NextResponse.redirect(new URL("/app/settings/packaging", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("packaging.by-id.post", handlePost);
