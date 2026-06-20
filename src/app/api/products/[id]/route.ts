import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  const form = await request.formData();
  const product = await db.product.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const intent = text(form, "intent");
  const updated = await db.product.update({
    where: { id: product.id },
    data: intent === "toggle"
      ? { isActive: !product.isActive, updatedBy: auth.session.userId }
      : { name: text(form, "name"), category: text(form, "category") || null, description: text(form, "description") || null, updatedBy: auth.session.userId }
  });
  await db.auditLog.create({
    data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: intent === "toggle" ? "product.toggled" : "product.updated", entityType: "Product", entityId: updated.id, metadata: { isActive: updated.isActive } }
  });
  return NextResponse.redirect(new URL("/app/products", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("products.by-id.post", handlePost);
