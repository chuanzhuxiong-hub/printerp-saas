import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { parseGcode } from "@/lib/gcode-parser";
import { assertUploadedFile, uploadLimits } from "@/lib/upload";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const file = assertUploadedFile(form.get("file"), { label: "G-code", maxBytes: uploadLimits.gcode, extensions: [".gcode", ".gc", ".txt"] });
  const targetType = text(form, "targetType");
  const targetId = text(form, "targetId");

  const analysis = parseGcode(await file.text());
  if (analysis.materialGrams === null && analysis.printHours === null) {
    throw new Error("未识别到耗材克数或打印时间，请确认文件包含切片器统计注释");
  }
  const materialGrams = analysis.materialGrams === null ? null : new Prisma.Decimal(analysis.materialGrams.toFixed(3));
  const printHours = analysis.printHours === null ? null : new Prisma.Decimal(analysis.printHours.toFixed(2));

  await db.$transaction(async (tx) => {
    if (targetType === "BOM") {
      const bom = await tx.productBom.findFirstOrThrow({
        where: { id: targetId, tenantId: session.tenantId, deletedAt: null }
      });
      let estimatedProductCost = bom.estimatedProductCost;
      if (materialGrams !== null && bom.defaultMaterialId) {
        const inventory = await tx.inventoryItem.findUnique({
          where: { tenantId_category_refId: { tenantId: session.tenantId, category: "MATERIAL", refId: bom.defaultMaterialId } }
        });
        const unitCost = inventory?.unitCost ?? new Prisma.Decimal(0);
        estimatedProductCost = estimatedProductCost
          .minus(bom.theoreticalGrams.mul(unitCost))
          .plus(materialGrams.mul(unitCost));
      }
      await tx.productBom.update({
        where: { id: bom.id },
        data: {
          theoreticalGrams: materialGrams ?? bom.theoreticalGrams,
          estimatedPrintHours: printHours ?? bom.estimatedPrintHours,
          estimatedProductCost,
          updatedBy: session.userId
        }
      });
    } else if (targetType === "PRODUCTION") {
      const production = await tx.productionOrder.findFirstOrThrow({
        where: { id: targetId, tenantId: session.tenantId, deletedAt: null }
      });
      if (["STOCKED", "FAILED", "SCRAPPED"].includes(production.status)) throw new Error("已结束的生产任务不能更新 G-code 预估值");
      await tx.productionOrder.update({
        where: { id: production.id },
        data: {
          actualMaterialGrams: materialGrams ?? production.actualMaterialGrams,
          actualPrintHours: printHours ?? production.actualPrintHours,
          updatedBy: session.userId
        }
      });
    } else {
      throw new Error("请选择更新目标");
    }

    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "gcode.analyzed",
        entityType: targetType === "BOM" ? "ProductBom" : "ProductionOrder",
        entityId: targetId,
        metadata: { fileName: file.name, ...analysis }
      }
    });
  });

  const params = new URLSearchParams({
    targetType,
    grams: materialGrams?.toString() ?? "-",
    hours: printHours?.toString() ?? "-",
    slicer: analysis.slicer ?? "未知"
  });
  return NextResponse.redirect(new URL(`/app/gcode?${params}`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("gcode.analyze", handlePost);
