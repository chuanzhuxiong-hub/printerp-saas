import { InventoryCategory, MaterialType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  const form = await request.formData();
  const material = await db.material.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const defaultSupplierId = text(form, "defaultSupplierId") || null;
  if (defaultSupplierId) {
    await db.supplier.findFirstOrThrow({ where: { id: defaultSupplierId, tenantId: auth.session.tenantId, deletedAt: null } });
  }
  const warningStock = new Prisma.Decimal(decimalText(form, "warningStock"));
  await db.$transaction(async (tx) => {
    const updated = await tx.material.update({ where: { id: material.id }, data: { name: text(form, "name"), type: text(form, "type") as MaterialType, color: text(form, "color") || null, brand: text(form, "brand") || null, defaultSupplierId, warningStock, remark: text(form, "remark") || null, updatedBy: auth.session!.userId } });
    await tx.inventoryItem.updateMany({ where: { tenantId: auth.session!.tenantId, category: InventoryCategory.MATERIAL, refId: material.id }, data: { name: updated.name, warningStock, updatedBy: auth.session!.userId } });
    await tx.auditLog.create({ data: { tenantId: auth.session!.tenantId, userId: auth.session!.userId, action: "material.updated", entityType: "Material", entityId: updated.id } });
  });
  return NextResponse.redirect(new URL("/app/settings/materials", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("materials.by-id.post", handlePost);
