import { InventoryTransactionType } from "@prisma/client";
import { db } from "../src/lib/db";
import { calculateInventoryMismatches } from "../src/lib/inventory-reconciliation";

async function main() {
  const apply = process.argv.includes("--apply");
  const items = await db.inventoryItem.findMany({ where: { deletedAt: null } });
  const rows = await db.inventoryTransaction.findMany({
    where: { tenantId: { in: [...new Set(items.map(item => item.tenantId))] } },
    select: { itemId: true, quantity: true }
  });
  const mismatches = calculateInventoryMismatches(items, rows);

  console.log(`Inventory mismatches: ${mismatches.length}`);
  for (const mismatch of mismatches) {
    const item = items.find(row => row.id === mismatch.itemId)!;
    console.log(`${item.tenantId} ${item.category}/${item.name}: ${mismatch.difference.toString()}`);
    if (!apply) continue;

    const sourceId = `balance-repair:${item.id}:${mismatch.ledgerBalance.toString()}:${mismatch.balance.toString()}`;
    const existing = await db.inventoryTransaction.findFirst({
      where: { tenantId: item.tenantId, sourceType: "InventoryLedgerRepair", sourceId }
    });
    if (existing) continue;
    await db.inventoryTransaction.create({
      data: {
        tenantId: item.tenantId,
        itemId: item.id,
        category: item.category,
        refId: item.refId,
        type: InventoryTransactionType.MANUAL_ADJUST,
        quantity: mismatch.difference,
        unitCost: item.unitCost,
        totalCost: mismatch.difference.mul(item.unitCost),
        sourceType: "InventoryLedgerRepair",
        sourceId,
        remark: "补录期初库存流水"
      }
    });
  }

  if (!apply) console.log("Dry run only. Re-run with --apply to append repair ledger entries.");
}

main().finally(() => db.$disconnect());
