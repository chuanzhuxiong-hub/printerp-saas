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
  const sku = await db.productSku.findFirstOrThrow({ where: { id, tenantId: auth.session.tenantId, deletedAt: null } });
  const intent = text(form, "intent");
  await db.$transaction(async (tx) => {
    const updated = await tx.productSku.update({
      where: { id: sku.id },
      data: intent === "toggle"
        ? { status: sku.status === "ACTIVE" ? "DISABLED" : "ACTIVE", updatedBy: auth.session!.userId }
        : {
            productId: text(form, "productId"),
            skuCode: text(form, "skuCode"),
            name: text(form, "name"),
            color: text(form, "color") || null,
            size: text(form, "size") || null,
            material: text(form, "material") || null,
            salePrice: new Prisma.Decimal(decimalText(form, "salePrice")),
            warningStock: new Prisma.Decimal(decimalText(form, "warningStock")),
            remark: text(form, "remark") || null,
            updatedBy: auth.session!.userId
          }
    });
    if (intent !== "toggle") {
      await tx.inventoryItem.update({
        where: { tenantId_category_refId: { tenantId: auth.session!.tenantId, category: InventoryCategory.PRODUCT, refId: sku.id } },
        data: { name: updated.name, warningStock: updated.warningStock, updatedBy: auth.session!.userId }
      });
    }
    await tx.auditLog.create({
      data: { tenantId: auth.session!.tenantId, userId: auth.session!.userId, action: intent === "toggle" ? "sku.toggled" : "sku.updated", entityType: "ProductSku", entityId: updated.id, metadata: { status: updated.status } }
    });
  });
  return NextResponse.redirect(new URL("/app/skus", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("skus.by-id.post", handlePost);
