import { strict as assert } from "node:assert";
import { inventoryBarcode, parseInventoryBarcode } from "../src/lib/barcode";

assert.equal(inventoryBarcode("MATERIAL", "abc"), "MATERIAL:abc");
assert.deepEqual(parseInventoryBarcode("PRODUCT:sku-1"), { category: "PRODUCT", refId: "sku-1" });
assert.deepEqual(parseInventoryBarcode("PACKAGING:item:part"), { category: "PACKAGING", refId: "item:part" });
assert.equal(parseInventoryBarcode("UNKNOWN:test"), null);
assert.equal(parseInventoryBarcode("MATERIAL"), null);
console.log("Barcode rules passed: 5 checks");
