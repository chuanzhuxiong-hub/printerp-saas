import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = readFileSync(join(process.cwd(), "src/app/app/production/page.tsx"), "utf8");

const requiredPhrases = [
  "生产中心",
  "生产看板",
  "表格视图",
  "打印机状态",
  "待生产",
  "打印中",
  "待质检",
  "已完成",
  "打印失败",
  "生产任务",
  "实际耗材",
  "实际成本",
  "完工入库"
];

const requiredComponents = ["PageHeader", "MetricCard", "StatusBadge", "DataTable"];

for (const phrase of requiredPhrases) {
  if (!file.includes(phrase)) {
    throw new Error(`Production center UI is missing phrase: ${phrase}`);
  }
}

for (const component of requiredComponents) {
  if (!file.includes(component)) {
    throw new Error(`Production center UI is missing component: ${component}`);
  }
}

console.log("Production center UI assertions passed.");
