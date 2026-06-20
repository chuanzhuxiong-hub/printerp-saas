import { readFileSync } from "node:fs";

const orderList = readFileSync("src/app/app/orders/page.tsx", "utf8");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const requiredPhrases = [
  "订单中心",
  "电商订单后台",
  "状态 Tabs",
  "待生产",
  "待发货",
  "售后中",
  "异常订单",
  "搜索订单号、客户、店铺",
  "利润明细",
  "生产状态",
  "发货状态",
  "售后状态"
];

for (const phrase of requiredPhrases) {
  assert(orderList.includes(phrase), `Order center is missing phrase: ${phrase}`);
}

const requiredComponents = ["PageHeader", "FilterBar", "StatusBadge", "DataTable", "MetricCard"];
for (const component of requiredComponents) {
  assert(orderList.includes(component), `Order center should use ${component}`);
}

console.log("Order center UI checks passed.");
