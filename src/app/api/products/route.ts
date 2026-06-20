import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const product = await db.product.create({
    data: {
      tenantId: auth.session.tenantId,
      name: text(form, "name"),
      category: text(form, "category") || null,
      description: text(form, "description") || null,
      createdBy: auth.session.userId
    }
  });
  await db.auditLog.create({
    data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "product.created", entityType: "Product", entityId: product.id }
  });
  return NextResponse.redirect(new URL("/app/products", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("products.post", handlePost);
