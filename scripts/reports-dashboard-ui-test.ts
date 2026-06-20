import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = readFileSync(join(process.cwd(), "src/app/app/reports/profit/page.tsx"), "utf8");

const requiredPhrases = [
  "报表中心",
  "经营利润驾驶舱",
  "今日利润",
  "本周利润",
  "本月利润",
  "经营净利润",
  "利润趋势",
  "SKU 利润排行",
  "店铺利润排行",
  "售后损失",
  "打印机效率",
  "耗材使用",
  "竞品分析",
  "自动选品分析",
  "订单毛利",
  "订单净利"
];

const requiredComponents = ["PageHeader", "MetricCard", "DataTable", "StatusBadge"];

for (const phrase of requiredPhrases) {
  if (!file.includes(phrase)) {
    throw new Error(`Reports dashboard UI is missing phrase: ${phrase}`);
  }
}

for (const component of requiredComponents) {
  if (!file.includes(component)) {
    throw new Error(`Reports dashboard UI is missing component: ${component}`);
  }
}

console.log("Reports dashboard UI assertions passed.");
