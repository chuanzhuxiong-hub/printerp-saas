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
  const returnTo = text(form, "returnTo");
  const skuId = text(form, "skuId");
  const materialId = text(form, "defaultMaterialId");
  const packagingId = text(form, "packagingId");
  const printerId = text(form, "printerId");

  const [sku, material, materialInventory, packaging, printer] = await Promise.all([
    db.productSku.findFirstOrThrow({ where: { id: skuId, tenantId: session.tenantId, deletedAt: null } }),
    db.material.findFirstOrThrow({ where: { id: materialId, tenantId: session.tenantId, deletedAt: null } }),
    db.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.MATERIAL, refId: materialId } } }),
    packagingId ? db.packagingItem.findFirstOrThrow({ where: { id: packagingId, tenantId: session.tenantId, deletedAt: null } }) : null,
    printerId ? db.printer.findFirstOrThrow({ where: { id: printerId, tenantId: session.tenantId, deletedAt: null } }) : null
  ]);

  const theoreticalGrams = new Prisma.Decimal(decimalText(form, "theoreticalGrams"));
  const wasteGrams = new Prisma.Decimal(decimalText(form, "wasteGrams"));
  const estimatedPrintHours = new Prisma.Decimal(decimalText(form, "estimatedPrintHours"));
  const laborMinutes = new Prisma.Decimal(decimalText(form, "laborMinutes"));
  const laborCostPerMinute = new Prisma.Decimal(decimalText(form, "laborCostPerMinute"));
  const electricityCost = new Prisma.Decimal(decimalText(form, "electricityCost"));
  const packagingQuantity = new Prisma.Decimal(decimalText(form, "packagingQuantity"));
  const materialUnitCost = materialInventory?.unitCost ?? new Prisma.Decimal(0);
  const packagingUnitCost = packaging?.unitPrice ?? new Prisma.Decimal(0);
  const packagingCost = packagingQuantity.mul(packagingUnitCost);
  const estimatedProductCost = theoreticalGrams
    .plus(wasteGrams)
    .mul(materialUnitCost)
    .plus(packagingCost)
    .plus(laborMinutes.mul(laborCostPerMinute))
    .plus(estimatedPrintHours.mul(printer?.depreciationPerHour ?? 0))
    .plus(electricityCost);

  await db.$transaction(async (tx) => {
    const bom = await tx.productBom.create({
      data: {
        tenantId: session.tenantId,
        skuId: sku.id,
        defaultMaterialId: material.id,
        theoreticalGrams,
        wasteGrams,
        estimatedPrintHours,
        laborMinutes,
        laborCostPerMinute,
        electricityCost,
        estimatedProductCost,
        remark: text(form, "remark") || null,
        createdBy: session.userId,
        items: packaging ? { create: [{ tenantId: session.tenantId, category: InventoryCategory.PACKAGING, refId: packaging.id, quantity: packagingQuantity, unitCost: packagingUnitCost, totalCost: packagingCost }] } : undefined
      }
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "bom.created",
        entityType: "ProductBom",
        entityId: bom.id,
        metadata: { materialUnitCost: materialUnitCost.toString(), printerId: printer?.id, estimatedProductCost: estimatedProductCost.toString() }
      }
    });
  });
  const target = returnTo.startsWith("/app/products/") ? returnTo : "/app/boms";
  return NextResponse.redirect(new URL(target, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("boms.post", handlePost);
