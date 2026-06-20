import { readFileSync } from "node:fs";
import { join } from "node:path";

const files = [
  "src/app/app/help/page.tsx",
  "src/app/app/help/getting-started/page.tsx",
  "src/components/onboarding-progress.tsx",
  "src/lib/help-content.ts",
  "src/lib/onboarding.ts"
].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

const requiredPhrases = [
  "帮助中心",
  "第一次使用 PrintERP",
  "初始化进度",
  "新手入门",
  "初始化设置",
  "产品与 SKU 管理",
  "耗材与采购管理",
  "生产与库存管理",
  "订单与发货管理",
  "售后与补发管理",
  "利润报表查看",
  "拼多多数据导入教程",
  "常见问题 FAQ",
  "第 1 步",
  "第 14 步",
  "继续初始化",
  "已完成",
  "未完成"
];

const requiredComponents = ["PageHeader", "MetricCard", "StatusBadge", "OnboardingProgress"];

for (const phrase of requiredPhrases) {
  if (!files.includes(phrase)) throw new Error(`Help center UI/content is missing phrase: ${phrase}`);
}

for (const component of requiredComponents) {
  if (!files.includes(component)) throw new Error(`Help center UI/content is missing component: ${component}`);
}

if (files.includes("�") || files.includes("鏂") || files.includes("鐢")) {
  throw new Error("Help center still contains mojibake Chinese text.");
}

console.log("Help center UI assertions passed.");
