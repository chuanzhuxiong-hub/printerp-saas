import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const name = text(form, "name");
  if (!name) return NextResponse.redirect(new URL("/app/settings/shops/new?error=required", process.env.APP_URL ?? request.url), 303);

  const shop = await db.shop.create({
    data: {
      tenantId: auth.session.tenantId,
      name,
      contactName: text(form, "contactName") || null,
      remark: text(form, "remark") || null,
      createdBy: auth.session.userId
    }
  });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "shop.created", entityType: "Shop", entityId: shop.id } });
  return NextResponse.redirect(new URL("/app/settings/shops", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("shops.post", handlePost);
