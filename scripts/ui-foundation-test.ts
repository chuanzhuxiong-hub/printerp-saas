import { existsSync } from "node:fs";
import { join } from "node:path";
import { navigationGroups } from "../src/lib/navigation";

const root = process.cwd();

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const expectedLabels = [
  "首页",
  "产品中心",
  "订单中心",
  "生产中心",
  "库存中心",
  "采购中心",
  "数据导入",
  "报表中心",
  "帮助中心",
  "系统设置"
];

const forbiddenPrimaryLabels = [
  "SKU 管理",
  "BOM 管理",
  "发货管理",
  "售后管理",
  "模型管理",
  "AI 标题管理",
  "AI 主图管理",
  "竞品管理"
];

const flatItems = navigationGroups.flatMap((group) => group.items);
const labels = flatItems.map((item) => item.label);

assert(
  expectedLabels.every((label) => labels.includes(label)),
  `Navigation must expose the commercial first-level entries: ${expectedLabels.join(", ")}`
);

assert(
  forbiddenPrimaryLabels.every((label) => !labels.includes(label)),
  `Navigation must not expose forbidden standalone primary entries: ${forbiddenPrimaryLabels.join(", ")}`
);

const requiredComponentFiles = [
  "src/components/app-header.tsx",
  "src/components/page-shell.tsx",
  "src/components/metric-card.tsx",
  "src/components/status-badge.tsx",
  "src/components/empty-state.tsx",
  "src/components/loading-skeleton.tsx",
  "src/components/filter-bar.tsx",
  "src/components/detail-drawer.tsx",
  "src/components/form-section.tsx",
  "src/components/trend-indicator.tsx",
  "src/components/inventory-warning-badge.tsx",
  "src/components/profit-badge.tsx"
];

for (const file of requiredComponentFiles) {
  assert(existsSync(join(root, file)), `Missing UI foundation component: ${file}`);
}

console.log("UI foundation checks passed.");
