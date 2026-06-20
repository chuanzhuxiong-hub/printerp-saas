import { strict as assert } from "node:assert";
import { getCostImportType, isValidCostAmount, normalizeCostRow } from "../src/lib/cost-import";

const shipping = normalizeCostRow({ 订单号: "SO-1001", 快递费: "￥12.50", 运单号: "YT001", 快递公司: "圆通" });
assert.equal(shipping.orderNo, "SO-1001");
assert.equal(shipping.amount, "12.50");
assert.equal(shipping.referenceNo, "YT001");
assert.equal(shipping.provider, "圆通");
assert.equal(isValidCostAmount(shipping.amount), true);

const advertising = normalizeCostRow({ "Order ID": "SO-1002", Spend: "$1,234.56", Platform: "Meta" });
assert.equal(advertising.orderNo, "SO-1002");
assert.equal(advertising.amount, "1234.56");
assert.equal(getCostImportType("ADVERTISING"), "ADVERTISING");
assert.equal(getCostImportType("unknown"), "SHIPPING");
assert.equal(isValidCostAmount("-5"), false);

console.log("Cost import adapters passed: 10 checks");
