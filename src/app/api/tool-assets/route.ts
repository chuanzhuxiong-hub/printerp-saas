import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/business-date";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const amount = new Prisma.Decimal(decimalText(form, "purchaseAmount"));
  const usefulLifeMonths = Math.max(1, Number.parseInt(text(form, "usefulLifeMonths"), 10) || 1);
  const assignedPrinterId = text(form, "assignedPrinterId") || null;
  if (assignedPrinterId) {
    await db.printer.findFirstOrThrow({ where: { id: assignedPrinterId, tenantId: session.tenantId, deletedAt: null } });
  }
  const asset = await db.toolAsset.create({
    data: {
      tenantId: session.tenantId, code: text(form, "code"), name: text(form, "name"), category: text(form, "category"),
      quantity: decimalText(form, "quantity", "1"), purchaseAmount: amount, purchaseDate: parseDateInput(text(form, "purchaseDate")),
      usefulLifeMonths, monthlyDepreciation: amount.div(usefulLifeMonths), assignedPrinterId,
      remark: text(form, "remark") || null, createdBy: session.userId
    }
  });
  await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "tool-asset.created", entityType: "ToolAsset", entityId: asset.id, metadata: { purchaseAmount: amount.toString(), monthlyDepreciation: asset.monthlyDepreciation.toString() } } });
  return NextResponse.redirect(new URL("/app/tool-assets?created=1", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("tool-assets.post", handlePost);
