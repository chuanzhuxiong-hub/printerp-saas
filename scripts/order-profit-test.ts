import { strict as assert } from "node:assert";
import { calculateOrderProfit } from "../src/lib/profit";

const profit = calculateOrderProfit({
  receivedAmount: "268.90",
  productCost: "84.35",
  shippingCost: "18.60",
  packagingCost: "6.45",
  platformFee: "12.30",
  paymentFee: "2.20",
  afterSaleCost: "25.50",
  adCost: "31.75"
});

assert.equal(profit.grossProfit.toFixed(2), "145.00");
assert.equal(profit.netProfit.toFixed(2), "87.75");

const refundOnly = calculateOrderProfit({
  receivedAmount: "100",
  productCost: "30",
  shippingCost: "10",
  packagingCost: "5",
  platformFee: "3",
  paymentFee: "2",
  afterSaleCost: "100",
  adCost: "0"
});

assert.equal(refundOnly.grossProfit.toFixed(2), "50.00");
assert.equal(refundOnly.netProfit.toFixed(2), "-50.00");

console.log("Order profit calculation passed: gross/net profit and refund loss covered");
