import { InventoryCategory, InventoryTransactionType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type TransactionClient = Prisma.TransactionClient;

type LedgerContext = {
  tenantId: string;
  type: InventoryTransactionType;
  sourceType: string;
  sourceId?: string;
  remark?: string;
  userId?: string;
};

type ExistingInventoryChange = LedgerContext & {
  itemId: string;
  quantity: Prisma.Decimal.Value;
};

async function appendLedger(
  tx: TransactionClient,
  item: { id: string; category: InventoryCategory; refId: string; unitCost: Prisma.Decimal },
  input: LedgerContext,
  signedQuantity: Prisma.Decimal
) {
  return tx.inventoryTransaction.create({
    data: {
      tenantId: input.tenantId,
      itemId: item.id,
      category: item.category,
      refId: item.refId,
      type: input.type,
      quantity: signedQuantity,
      unitCost: item.unitCost,
      totalCost: signedQuantity.mul(item.unitCost),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      remark: input.remark,
      createdBy: input.userId
    }
  });
}

export async function decreaseInventory(tx: TransactionClient, input: ExistingInventoryChange) {
  const quantity = new Prisma.Decimal(input.quantity);
  if (quantity.lte(0)) throw new Error("库存扣减数量必须大于 0");

  const item = await tx.inventoryItem.findFirstOrThrow({
    where: { id: input.itemId, tenantId: input.tenantId, deletedAt: null }
  });
  const result = await tx.inventoryItem.updateMany({
    where: {
      id: item.id,
      tenantId: input.tenantId,
      deletedAt: null,
      quantity: { gte: quantity.plus(item.lockedQuantity) },
      lockedQuantity: item.lockedQuantity
    },
    data: { quantity: { decrement: quantity }, updatedBy: input.userId }
  });
  if (result.count !== 1) {
    throw new Error(`库存不足，当前可用库存为 ${item.quantity.minus(item.lockedQuantity)}`);
  }

  const transaction = await appendLedger(tx, item, input, quantity.negated());
  const inventory = await tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  return { inventory, transaction };
}

export async function increaseInventory(tx: TransactionClient, input: ExistingInventoryChange) {
  const quantity = new Prisma.Decimal(input.quantity);
  if (quantity.lte(0)) throw new Error("库存增加数量必须大于 0");

  const item = await tx.inventoryItem.findFirstOrThrow({
    where: { id: input.itemId, tenantId: input.tenantId, deletedAt: null }
  });
  const inventory = await tx.inventoryItem.update({
    where: { id: item.id },
    data: { quantity: { increment: quantity }, updatedBy: input.userId }
  });
  const transaction = await appendLedger(tx, item, input, quantity);
  return { inventory, transaction };
}

export async function adjustInventory(tx: TransactionClient, input: ExistingInventoryChange) {
  const signedQuantity = new Prisma.Decimal(input.quantity);
  if (signedQuantity.eq(0)) throw new Error("库存调整数量不能为 0");
  return signedQuantity.gt(0)
    ? increaseInventory(tx, { ...input, quantity: signedQuantity })
    : decreaseInventory(tx, { ...input, quantity: signedQuantity.abs() });
}

type InventoryChange = {
  tenantId: string;
  category: InventoryCategory;
  refId: string;
  name: string;
  type: InventoryTransactionType;
  quantity: Prisma.Decimal.Value;
  unitCost: Prisma.Decimal.Value;
  sourceType: string;
  sourceId: string;
  userId?: string;
};

export async function changeInventory(input: InventoryChange) {
  const quantity = new Prisma.Decimal(input.quantity);
  const unitCost = new Prisma.Decimal(input.unitCost);

  return db.$transaction(async (tx) => {
    const inventory = await tx.inventoryItem.upsert({
      where: {
        tenantId_category_refId: {
          tenantId: input.tenantId,
          category: input.category,
          refId: input.refId
        }
      },
      create: {
        tenantId: input.tenantId,
        category: input.category,
        refId: input.refId,
        name: input.name,
        quantity,
        unitCost
      },
      update: {
        quantity: { increment: quantity },
        unitCost
      }
    });

    const transaction = await tx.inventoryTransaction.create({
      data: {
        tenantId: input.tenantId,
        itemId: inventory.id,
        category: input.category,
        refId: input.refId,
        type: input.type,
        quantity,
        unitCost,
        totalCost: quantity.mul(unitCost),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdBy: input.userId
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: "inventory.changed",
        entityType: "InventoryTransaction",
        entityId: transaction.id,
        metadata: { type: input.type, refId: input.refId, quantity: quantity.toString() }
      }
    });

    return { inventory, transaction };
  });
}
