import { readFileSync } from "node:fs";

const source = readFileSync("src/app/app/inventory/page.tsx", "utf8");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const requiredPhrases = [
  "库存中心",
  "耗材库存",
  "成品库存",
  "包装库存",
  "库存流水",
  "库存预警",
  "统一走库存流水",
  "搜索库存名称",
  "低库存",
  "扫码出入库",
  "补货建议",
  "库存调整"
];

for (const phrase of requiredPhrases) {
  assert(source.includes(phrase), `Inventory center is missing phrase: ${phrase}`);
}

const requiredComponents = ["PageHeader", "FilterBar", "StatusBadge", "DataTable", "MetricCard"];
for (const component of requiredComponents) {
  assert(source.includes(component), `Inventory center should use ${component}`);
}

console.log("Inventory center UI checks passed.");
