import { InventoryCategory, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const productId = text(form, "productId");
  const returnTo = text(form, "returnTo");
  await db.product.findFirstOrThrow({ where: { id: productId, tenantId: session.tenantId, deletedAt: null } });

  await db.$transaction(async (tx) => {
    const sku = await tx.productSku.create({
      data: {
        tenantId: session.tenantId,
        productId,
        skuCode: text(form, "skuCode"),
        name: text(form, "name"),
        color: text(form, "color") || null,
        size: text(form, "size") || null,
        material: text(form, "material") || null,
        salePrice: new Prisma.Decimal(decimalText(form, "salePrice")),
        warningStock: new Prisma.Decimal(decimalText(form, "warningStock")),
        remark: text(form, "remark") || null,
        createdBy: session.userId
      }
    });
    await tx.inventoryItem.create({
      data: {
        tenantId: session.tenantId,
        category: InventoryCategory.PRODUCT,
        refId: sku.id,
        name: sku.name,
        quantity: 0,
        warningStock: sku.warningStock,
        unitCost: 0,
        createdBy: session.userId
      }
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "sku.created",
        entityType: "ProductSku",
        entityId: sku.id,
        metadata: { inventoryInitialized: true }
      }
    });
  });
  const target = returnTo.startsWith("/app/products/") ? returnTo : "/app/skus";
  return NextResponse.redirect(new URL(target, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("skus.post", handlePost);
