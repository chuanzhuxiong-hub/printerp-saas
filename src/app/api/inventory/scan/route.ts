import { InventoryTransactionType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseInventoryBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { adjustInventory } from "@/lib/inventory";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const barcode = text(form, "barcode");
  const parsed = parseInventoryBarcode(barcode);
  const quantity = new Prisma.Decimal(decimalText(form, "quantity", "1"));
  const direction = text(form, "direction") === "OUT" ? "OUT" : "IN";
  if (quantity.lte(0)) throw new Error("扫码数量必须大于 0");
  const item = parsed
    ? await db.inventoryItem.findUnique({ where: { tenantId_category_refId: { tenantId: session.tenantId, category: parsed.category, refId: parsed.refId } } })
    : await db.inventoryItem.findFirst({ where: { id: barcode, tenantId: session.tenantId, deletedAt: null } });
  if (!item || item.deletedAt) throw new Error("未识别到库存条码");
  const signed = direction === "OUT" ? quantity.negated() : quantity;

  await db.$transaction(async tx => {
    const { transaction } = await adjustInventory(tx, {
      tenantId: session.tenantId,
      itemId: item.id,
      quantity: signed,
      type: direction === "IN" ? InventoryTransactionType.STOCK_GAIN : InventoryTransactionType.STOCK_LOSS,
      sourceType: "BarcodeScan",
      sourceId: barcode,
      remark: text(form, "remark") || "扫码入出库",
      userId: session.userId
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "inventory.barcode-scanned",
        entityType: "InventoryTransaction",
        entityId: transaction.id,
        metadata: { barcode, direction, quantity: quantity.toString() }
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return NextResponse.redirect(new URL(`/app/inventory/scan?success=1&item=${encodeURIComponent(item.name)}&direction=${direction}`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("inventory.scan.post", handlePost);
