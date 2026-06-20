import { MaterialType } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const defaultSupplierId = text(form, "defaultSupplierId") || null;
  if (defaultSupplierId) {
    await db.supplier.findFirstOrThrow({ where: { id: defaultSupplierId, tenantId: auth.session.tenantId, deletedAt: null } });
  }
  const material = await db.material.create({
    data: {
      tenantId: auth.session.tenantId,
      name: text(form, "name"),
      type: text(form, "type") as MaterialType,
      color: text(form, "color") || null,
      brand: text(form, "brand") || null,
      defaultSupplierId,
      warningStock: decimalText(form, "warningStock"),
      createdBy: auth.session.userId
    }
  });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "material.created", entityType: "Material", entityId: material.id } });
  return NextResponse.redirect(new URL("/app/settings/materials", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("materials.post", handlePost);
