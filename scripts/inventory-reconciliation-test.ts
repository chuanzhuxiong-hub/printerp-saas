import assert from "node:assert/strict";
import { calculateInventoryMismatches } from "../src/lib/inventory-reconciliation";

const mismatches = calculateInventoryMismatches(
  [
    { id: "zero", quantity: "0" },
    { id: "missing-opening", quantity: "200" },
    { id: "matched", quantity: "12" },
    { id: "drifted", quantity: "7" }
  ],
  [
    { itemId: "matched", quantity: "10" },
    { itemId: "matched", quantity: "2" },
    { itemId: "drifted", quantity: "5" }
  ]
);

assert.deepEqual(
  mismatches.map(item => ({
    itemId: item.itemId,
    balance: item.balance.toString(),
    ledgerBalance: item.ledgerBalance.toString(),
    difference: item.difference.toString()
  })),
  [
    { itemId: "missing-opening", balance: "200", ledgerBalance: "0", difference: "200" },
    { itemId: "drifted", balance: "7", ledgerBalance: "5", difference: "2" }
  ]
);

console.log("Inventory reconciliation calculation passed");
