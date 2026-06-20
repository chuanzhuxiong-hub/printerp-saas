import { strict as assert } from "node:assert";
import { channelForPlatform, detectImportPlatform, normalizeOrderRow } from "../src/lib/order-import";

const pdd = normalizeOrderRow({
  订单号: "PDD-1001",
  "商家编码-规格维度": "SKU-RED",
  商品数量: "2",
  商品单价: "19.90",
  商家实收金额: "35.80",
  订单状态: "已发货"
}, "PINDUODUO");

assert.equal(pdd.orderNo, "PDD-1001");
assert.equal(pdd.skuCode, "SKU-RED");
assert.equal(pdd.quantity, 2);
assert.equal(pdd.status, "SHIPPED");
assert.equal(channelForPlatform("PINDUODUO"), "PINDUODUO");

const realPdd = normalizeOrderRow({
  商品: "古风花盆",
  订单号: "260531-100",
  "商品总价(元)": "22.2\t",
  "商家实收金额(元)": "21.2\t",
  "商品数量(件)": "1\t",
  商品规格: "黑色,大款",
  样式ID: "1871385314709\t",
  订单成交时间: "2026-05-31 13:31:06"
}, "PINDUODUO");
assert.equal(realPdd.skuCode, "PDD-1871385314709");
assert.equal(realPdd.productName, "古风花盆");
assert.equal(realPdd.specification, "黑色,大款");
assert.equal(realPdd.unitPrice, "22.2");
assert.equal(realPdd.orderedAt?.toISOString().slice(0, 10), "2026-05-31");
assert.equal(detectImportPlatform([{ 样式ID: "1", "商家实收金额(元)": "1", 订单成交时间: "2026-05-01" }], "GENERIC"), "PINDUODUO");
assert.equal(normalizeOrderRow({ 订单号: "260515-100", 样式ID: "1" }, "PINDUODUO").orderedAt?.toISOString().slice(0, 10), "2026-05-15");

const shopify = normalizeOrderRow({
  Name: "#1002",
  "Lineitem sku": "SKU-BLUE",
  "Lineitem quantity": "3",
  "Lineitem price": "8.50",
  Total: "25.50",
  "Financial Status": "paid"
}, "SHOPIFY");

assert.equal(shopify.orderNo, "#1002");
assert.equal(shopify.skuCode, "SKU-BLUE");
assert.equal(shopify.quantity, 3);
assert.equal(shopify.status, "PAID");

console.log("Order import adapters passed: 10 checks");
