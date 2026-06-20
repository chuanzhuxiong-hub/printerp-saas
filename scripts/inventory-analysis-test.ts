import { strict as assert } from "node:assert";
import { calculateReplenishment, isSlowInventory } from "../src/lib/inventory-analysis";

const urgent = calculateReplenishment({ quantity: 50, lockedQuantity: 10, warningStock: 100, consumedLast30Days: 300 });
assert.equal(urgent.available.toString(), "40");
assert.equal(urgent.averageDaily.toString(), "10");
assert.equal(urgent.coverageDays?.toString(), "4");
assert.equal(urgent.recommendedQuantity.toString(), "260");
assert.equal(urgent.urgent, true);

const stable = calculateReplenishment({ quantity: 500, lockedQuantity: 0, warningStock: 100, consumedLast30Days: 0 });
assert.equal(stable.urgent, false);
assert.equal(stable.recommendedQuantity.toString(), "0");

const slow = isSlowInventory({ quantity: 5, soldLast60Days: 0, lastSoldAt: null });
assert.equal(slow.slow, true);
assert.equal(isSlowInventory({ quantity: 5, soldLast60Days: 1, lastSoldAt: new Date() }).slow, false);

console.log("Inventory analysis passed: 9 checks");
