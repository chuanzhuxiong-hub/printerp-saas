import { readFileSync } from "node:fs";

const source = readFileSync("src/app/app/products/page.tsx", "utf8");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const requiredPhrases = [
  "产品中心",
  "SKU 展开",
  "BOM / 打印配方",
  "默认模型",
  "库存警戒线",
  "AI 标题",
  "AI 主图",
  "AI 详情页",
  "竞品监控",
  "自动选品池",
  "salesDisplayValue",
  "salesEstimate",
  "salesActual",
  "最多 5 个竞品"
];

for (const phrase of requiredPhrases) {
  assert(source.includes(phrase), `Product center is missing required phrase: ${phrase}`);
}

const requiredComponents = ["PageHeader", "StatusBadge", "FilterBar", "DataTable"];
for (const component of requiredComponents) {
  assert(source.includes(component), `Product center should use ${component}`);
}

console.log("Product center UI checks passed.");
