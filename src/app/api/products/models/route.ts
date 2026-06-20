import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

const supportedTypes = new Set(["STL", "3MF", "OBJ", "STEP", "GCODE", "OTHER"]);

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const action = text(form, "action");
  const productId = text(form, "productId");
  await db.product.findFirstOrThrow({ where: { id: productId, tenantId: session.tenantId, deletedAt: null } });

  if (action === "create") {
    const skuId = text(form, "skuId") || null;
    if (skuId) await db.productSku.findFirstOrThrow({ where: { id: skuId, productId, tenantId: session.tenantId, deletedAt: null } });
    const fileType = text(form, "fileType").toUpperCase();
    if (!supportedTypes.has(fileType)) throw new Error("不支持的模型文件格式");
    let printSettings: Prisma.InputJsonValue | undefined;
    const settingsText = text(form, "printSettings");
    if (settingsText) printSettings = JSON.parse(settingsText) as Prisma.InputJsonValue;
    const version = await db.productModel.count({ where: { tenantId: session.tenantId, productId } });
    const model = await db.productModel.create({
      data: {
        tenantId: session.tenantId, productId, skuId, name: text(form, "name"), fileUrl: text(form, "fileUrl"),
        fileType, version: version + 1, printSettings, remark: text(form, "remark") || null, createdBy: session.userId
      }
    });
    await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "product-model.created", entityType: "ProductModel", entityId: model.id, metadata: { productId, fileType, version: model.version } } });
  } else {
    const model = await db.productModel.findFirstOrThrow({ where: { id: text(form, "modelId"), productId, tenantId: session.tenantId } });
    if (action === "adopt") {
      await db.$transaction([
        db.productModel.updateMany({ where: { tenantId: session.tenantId, productId, skuId: model.skuId }, data: { isCurrent: false } }),
        db.productModel.update({ where: { id: model.id }, data: { isCurrent: true, status: "ACTIVE", updatedBy: session.userId } })
      ]);
    } else if (action === "archive") {
      await db.productModel.update({ where: { id: model.id }, data: { isCurrent: false, status: "ARCHIVED", updatedBy: session.userId } });
    } else {
      throw new Error("不支持的模型操作");
    }
    await db.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: `product-model.${action}`, entityType: "ProductModel", entityId: model.id, metadata: { productId } } });
  }

  return NextResponse.redirect(new URL(`/app/products/${productId}?tab=models&saved=1`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("products.models.post", handlePost);
