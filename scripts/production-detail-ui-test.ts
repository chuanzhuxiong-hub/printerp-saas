import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = readFileSync(join(process.cwd(), "src/app/app/production/[id]/page.tsx"), "utf8");

const requiredPhrases = [
  "生产工作台",
  "生产概览",
  "SKU 明细",
  "打印失败",
  "库存流水",
  "成本追溯",
  "操作日志",
  "完工入库",
  "实际耗材",
  "实际打印时间",
  "失败成本"
];

const requiredComponents = ["PageHeader", "MetricCard", "StatusBadge", "DataTable"];

for (const phrase of requiredPhrases) {
  if (!file.includes(phrase)) {
    throw new Error(`Production detail UI is missing phrase: ${phrase}`);
  }
}

for (const component of requiredComponents) {
  if (!file.includes(component)) {
    throw new Error(`Production detail UI is missing component: ${component}`);
  }
}

console.log("Production detail UI assertions passed.");
