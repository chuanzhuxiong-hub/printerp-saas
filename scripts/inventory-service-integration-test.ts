import assert from "node:assert/strict";
import { InventoryCategory, InventoryTransactionType, Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { decreaseInventory } from "../src/lib/inventory";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { deletedAt: null } });
  const refId = `inventory-service-test-${Date.now()}`;
  const item = await db.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      category: InventoryCategory.PACKAGING,
      refId,
      name: "Inventory service integration test",
      quantity: new Prisma.Decimal(5),
      lockedQuantity: new Prisma.Decimal(1),
      unitCost: new Prisma.Decimal("2.5")
    }
  });

  try {
  await db.$transaction(async tx => {
    await decreaseInventory(tx, {
      tenantId: tenant.id,
      itemId: item.id,
      quantity: 4,
      type: InventoryTransactionType.SALES_OUT,
      sourceType: "InventoryServiceTest",
      sourceId: refId
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const after = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  const rows = await db.inventoryTransaction.findMany({ where: { sourceType: "InventoryServiceTest", sourceId: refId } });
  assert.equal(after.quantity.toString(), "1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity.toString(), "-4");
  assert.equal(rows[0].totalCost.toString(), "-10");

  await assert.rejects(
    db.$transaction(async tx => {
      await decreaseInventory(tx, {
        tenantId: tenant.id,
        itemId: item.id,
        quantity: 1,
        type: InventoryTransactionType.SALES_OUT,
        sourceType: "InventoryServiceTest",
        sourceId: `${refId}-rejected`
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    /库存不足/
  );

  assert.equal(await db.inventoryTransaction.count({ where: { sourceId: `${refId}-rejected` } }), 0);
  console.log("Inventory service integration passed");
  } finally {
    await db.inventoryTransaction.deleteMany({ where: { itemId: item.id } });
    await db.inventoryItem.delete({ where: { id: item.id } });
  }
}

main().finally(() => db.$disconnect());
