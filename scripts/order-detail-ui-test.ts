import { readFileSync } from "node:fs";

const orderDetail = readFileSync("src/app/app/orders/[id]/page.tsx", "utf8");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const requiredPhrases = [
  "订单工作台",
  "订单概览",
  "利润明细",
  "商品明细",
  "生产记录",
  "发货记录",
  "售后记录",
  "成本追溯",
  "操作日志",
  "创建生产任务",
  "为此订单发货",
  "登记售后"
];

for (const phrase of requiredPhrases) {
  assert(orderDetail.includes(phrase), `Order detail is missing phrase: ${phrase}`);
}

const requiredComponents = ["PageHeader", "StatusBadge", "MetricCard", "DataTable"];
for (const component of requiredComponents) {
  assert(orderDetail.includes(component), `Order detail should use ${component}`);
}

console.log("Order detail UI checks passed.");
