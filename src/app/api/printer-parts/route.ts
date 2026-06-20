import { InventoryCategory, InventoryTransactionType, Prisma, PrinterStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseDateInput, todayInputValue } from "@/lib/business-date";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { nextMaintenanceDate } from "@/lib/printer-maintenance";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const action = text(form, "action");
  const occurredAt = parseDateInput(text(form, "occurredAt") || todayInputValue());

  if (action === "create") {
    await db.$transaction(async tx => {
      const supplierId = text(form, "supplierId") || null;
      if (supplierId) await tx.supplier.findFirstOrThrow({ where: { id: supplierId, tenantId: session.tenantId, deletedAt: null } });
      const part = await tx.printerPart.create({
        data: {
          tenantId: session.tenantId, code: text(form, "code"), name: text(form, "name"),
          compatibleModel: text(form, "compatibleModel") || null, unit: text(form, "unit") || "个",
          warningStock: decimalText(form, "warningStock"), supplierId,
          remark: text(form, "remark") || null, createdBy: session.userId
        }
      });
      await tx.inventoryItem.create({
        data: {
          tenantId: session.tenantId, category: InventoryCategory.PART, refId: part.id, name: part.name,
          quantity: 0, warningStock: part.warningStock, unitCost: 0, createdBy: session.userId
        }
      });
    });
    return NextResponse.redirect(new URL("/app/printer-parts?created=1", process.env.APP_URL ?? request.url), 303);
  }

  await db.$transaction(async tx => {
    const part = await tx.printerPart.findFirstOrThrow({ where: { id: text(form, "partId"), tenantId: session.tenantId, deletedAt: null } });
    const quantity = new Prisma.Decimal(decimalText(form, "quantity"));
    if (quantity.lte(0)) throw new Error("数量必须大于 0");

    if (action === "purchase") {
      const amount = new Prisma.Decimal(decimalText(form, "amount"));
      const nextQuantity = part.quantity.plus(quantity);
      const unitCost = part.quantity.mul(part.unitCost).plus(amount).div(nextQuantity);
      await tx.printerPart.update({ where: { id: part.id }, data: { quantity: nextQuantity, unitCost, updatedBy: session.userId } });
      const row = await tx.printerPartTransaction.create({
        data: { tenantId: session.tenantId, partId: part.id, type: "PURCHASE_IN", quantity, unitCost: amount.div(quantity), totalCost: amount, occurredAt, remark: text(form, "remark") || null, createdBy: session.userId }
      });
      const inventory = await tx.inventoryItem.upsert({
        where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PART, refId: part.id } },
        create: { tenantId: session.tenantId, category: InventoryCategory.PART, refId: part.id, name: part.name, quantity: nextQuantity, warningStock: part.warningStock, unitCost, createdBy: session.userId },
        update: { quantity: nextQuantity, unitCost, warningStock: part.warningStock, updatedBy: session.userId }
      });
      await tx.inventoryTransaction.create({
        data: { tenantId: session.tenantId, itemId: inventory.id, category: InventoryCategory.PART, refId: part.id, type: InventoryTransactionType.PURCHASE_IN, quantity, unitCost: amount.div(quantity), totalCost: amount, sourceType: "PrinterPartTransaction", sourceId: row.id, createdAt: occurredAt, createdBy: session.userId }
      });
      await tx.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "printer-part.purchased", entityType: "PrinterPartTransaction", entityId: row.id, metadata: { partId: part.id, quantity: quantity.toString(), amount: amount.toString() } } });
      return;
    }

    if (action !== "replace") throw new Error("不支持的配件操作");
    if (part.quantity.lt(quantity)) throw new Error(`配件库存不足，当前库存为 ${part.quantity}`);
    const printer = await tx.printer.findFirstOrThrow({ where: { id: text(form, "printerId"), tenantId: session.tenantId, deletedAt: null } });
    const runtime = await tx.productionOrder.aggregate({ where: { tenantId: session.tenantId, printerId: printer.id, deletedAt: null }, _sum: { actualPrintHours: true } });
    const totalRuntimeHours = runtime._sum.actualPrintHours ?? new Prisma.Decimal(0);
    const partCost = part.unitCost.mul(quantity);
    const laborCost = new Prisma.Decimal(decimalText(form, "laborCost"));
    const totalCost = partCost.plus(laborCost);
    const record = await tx.printerMaintenanceRecord.create({
      data: {
        tenantId: session.tenantId, printerId: printer.id, maintenanceType: `更换配件：${part.name}`, performedAt: occurredAt,
        runtimeHoursAtService: totalRuntimeHours, cost: totalCost, operatorName: text(form, "operatorName") || null,
        details: text(form, "remark") || null, createdBy: session.userId
      }
    });
    const nextQuantity = part.quantity.minus(quantity);
    await tx.printerPart.update({ where: { id: part.id }, data: { quantity: nextQuantity, updatedBy: session.userId } });
    const row = await tx.printerPartTransaction.create({
      data: { tenantId: session.tenantId, partId: part.id, printerId: printer.id, maintenanceRecordId: record.id, type: "REPLACEMENT_OUT", quantity: quantity.negated(), unitCost: part.unitCost, totalCost: partCost, occurredAt, remark: text(form, "remark") || null, createdBy: session.userId }
    });
    const inventory = await tx.inventoryItem.upsert({
      where: { tenantId_category_refId: { tenantId: session.tenantId, category: InventoryCategory.PART, refId: part.id } },
      create: { tenantId: session.tenantId, category: InventoryCategory.PART, refId: part.id, name: part.name, quantity: nextQuantity, warningStock: part.warningStock, unitCost: part.unitCost, createdBy: session.userId },
      update: { quantity: nextQuantity, unitCost: part.unitCost, warningStock: part.warningStock, updatedBy: session.userId }
    });
    await tx.inventoryTransaction.create({
      data: { tenantId: session.tenantId, itemId: inventory.id, category: InventoryCategory.PART, refId: part.id, type: InventoryTransactionType.SCRAP, quantity: quantity.negated(), unitCost: part.unitCost, totalCost: partCost.negated(), sourceType: "PrinterPartTransaction", sourceId: row.id, createdAt: occurredAt, remark: "打印机配件更换出库", createdBy: session.userId }
    });
    await tx.printer.update({
      where: { id: printer.id },
      data: { lastMaintenanceAt: occurredAt, nextMaintenanceAt: nextMaintenanceDate(occurredAt, printer.maintenanceIntervalDays), lastMaintenanceHours: totalRuntimeHours, status: printer.status === PrinterStatus.MAINTENANCE ? PrinterStatus.IDLE : printer.status, updatedBy: session.userId }
    });
    await tx.costRecord.create({ data: { tenantId: session.tenantId, sourceType: "PrinterPartReplacement", sourceId: row.id, printerId: printer.id, amount: totalCost, remark: `${part.name} × ${quantity.toString()}`, createdBy: session.userId } });
    await tx.auditLog.create({ data: { tenantId: session.tenantId, userId: session.userId, action: "printer-part.replaced", entityType: "PrinterPartTransaction", entityId: row.id, metadata: { partId: part.id, printerId: printer.id, partCost: partCost.toString(), laborCost: laborCost.toString(), totalCost: totalCost.toString() } } });
  });
  return NextResponse.redirect(new URL(`/app/printer-parts?${action === "replace" ? "replaced" : "purchased"}=1`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("printer-parts.post", handlePost);
