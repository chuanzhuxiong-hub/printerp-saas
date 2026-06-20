import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  const form = await request.formData();
  const supplier = await db.supplier.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const intent = text(form, "intent");
  const updated = await db.supplier.update({
    where: { id: supplier.id },
    data: intent === "toggle"
      ? { isActive: !supplier.isActive, updatedBy: auth.session.userId }
      : { name: text(form, "name"), contact: text(form, "contact") || null, phone: text(form, "phone") || null, remark: text(form, "remark") || null, updatedBy: auth.session.userId }
  });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: intent === "toggle" ? "supplier.toggled" : "supplier.updated", entityType: "Supplier", entityId: updated.id, metadata: { isActive: updated.isActive } } });
  return NextResponse.redirect(new URL("/app/settings/suppliers", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("suppliers.by-id.post", handlePost);
