import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const item = await db.packagingItem.create({
    data: {
      tenantId: auth.session.tenantId,
      name: text(form, "name"),
      spec: text(form, "spec") || null,
      unit: text(form, "unit"),
      unitPrice: decimalText(form, "unitPrice"),
      warningStock: decimalText(form, "warningStock"),
      createdBy: auth.session.userId
    }
  });
  await db.auditLog.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "packaging.created", entityType: "PackagingItem", entityId: item.id } });
  return NextResponse.redirect(new URL("/app/settings/packaging", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("packaging.post", handlePost);
