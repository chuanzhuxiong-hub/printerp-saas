import { readFileSync } from "node:fs";

const source = readFileSync("src/app/app/products/[id]/page.tsx", "utf8");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const requiredPhrases = [
  "产品工作台",
  "SKU / BOM",
  "模型文件",
  "AI 内容",
  "竞品监控",
  "未配置 BOM",
  "未绑定模型",
  "AI 标题",
  "AI 主图",
  "AI 详情页",
  "salesDisplayValue",
  "salesEstimate",
  "salesActual",
  "最多 5 个竞品"
];

for (const phrase of requiredPhrases) {
  assert(source.includes(phrase), `Product detail is missing required phrase: ${phrase}`);
}

const requiredComponents = ["PageHeader", "StatusBadge", "MetricCard", "DataTable", "FormSection"];
for (const component of requiredComponents) {
  assert(source.includes(component), `Product detail should use ${component}`);
}

console.log("Product detail UI checks passed.");
