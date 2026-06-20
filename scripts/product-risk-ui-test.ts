import { readFileSync } from "node:fs";

const productCenter = readFileSync("src/app/app/products/page.tsx", "utf8");
const productDetail = readFileSync("src/app/app/products/[id]/page.tsx", "utf8");
const combined = `${productCenter}\n${productDetail}`;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

for (const phrase of ["风险提示", "低利润", "低库存", "毛利预警", "库存不足", "操作面板"]) {
  assert(combined.includes(phrase), `Product risk UI is missing phrase: ${phrase}`);
}

assert(productCenter.includes("db.inventoryItem.findMany"), "Product center should read product inventory for low-stock warnings");
assert(productDetail.includes("db.inventoryItem.findMany"), "Product detail should read product inventory for low-stock warnings");

console.log("Product risk UI checks passed.");
