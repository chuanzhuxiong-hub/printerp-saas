import { InventoryTransactionType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { adjustInventory } from "@/lib/inventory";

const allowedTypes = ["STOCK_GAIN", "STOCK_LOSS", "SCRAP", "MANUAL_ADJUST"] as const;

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const itemId = text(form, "itemId");
  const type = text(form, "type") as typeof allowedTypes[number];
  if (!allowedTypes.includes(type)) throw new Error("不支持的库存调整类型");
  const inputQuantity = new Prisma.Decimal(decimalText(form, "quantity"));
  if (inputQuantity.lte(0)) throw new Error("调整数量必须大于 0");

  await db.$transaction(async tx => {
    const item = await tx.inventoryItem.findFirstOrThrow({ where: { id: itemId, tenantId: session.tenantId, deletedAt: null } });
    const signedQuantity = type === "STOCK_GAIN"
      ? inputQuantity
      : type === "MANUAL_ADJUST"
        ? new Prisma.Decimal(decimalText(form, "signedQuantity"))
        : inputQuantity.negated();
    const { inventory, transaction } = await adjustInventory(tx, {
      tenantId: session.tenantId,
      itemId: item.id,
      quantity: signedQuantity,
      type: type as InventoryTransactionType,
      sourceType: "InventoryAdjustment",
      remark: text(form, "remark") || undefined,
      userId: session.userId
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "inventory.adjusted",
        entityType: "InventoryTransaction",
        entityId: transaction.id,
        metadata: { type, before: item.quantity.toString(), after: inventory.quantity.toString() }
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return NextResponse.redirect(new URL("/app/inventory/transactions", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("inventory.adjustments.create", handlePost);
