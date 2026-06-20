import { readFileSync } from "node:fs";

const source = readFileSync("src/app/app/dashboard/page.tsx", "utf8");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const requiredPhrases = [
  "经营驾驶舱",
  "今日销售额",
  "今日净利润",
  "今日订单数",
  "待生产",
  "待发货",
  "库存预警",
  "售后成本",
  "打印失败",
  "利润趋势",
  "SKU 利润排行",
  "店铺利润排行",
  "打印机状态",
  "经营待办"
];

for (const phrase of requiredPhrases) {
  assert(source.includes(phrase), `Dashboard is missing commercial cockpit phrase: ${phrase}`);
}

const requiredComponents = [
  "MetricCard",
  "StatusBadge",
  "TrendIndicator",
  "OnboardingProgress"
];

for (const component of requiredComponents) {
  assert(source.includes(component), `Dashboard should use ${component}`);
}

console.log("Dashboard UI checks passed.");
