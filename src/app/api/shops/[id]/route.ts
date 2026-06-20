import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const { id } = await context.params;
  const form = await request.formData();
  const shop = await db.shop.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const intent = text(form, "intent");
  const updated = await db.shop.update({
    where: { id: shop.id },
    data: intent === "toggle"
      ? { isActive: !shop.isActive, updatedBy: auth.session.userId }
      : { name: text(form, "name"), contactName: text(form, "contactName") || null, remark: text(form, "remark") || null, updatedBy: auth.session.userId }
  });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: intent === "toggle" ? "shop.toggled" : "shop.updated", entityType: "Shop", entityId: updated.id, metadata: { isActive: updated.isActive } } });
  return NextResponse.redirect(new URL("/app/settings/shops", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("shops.by-id.post", handlePost);
