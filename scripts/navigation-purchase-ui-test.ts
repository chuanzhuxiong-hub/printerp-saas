import { readFileSync } from "node:fs";
import { join } from "node:path";

const files = [
  "src/lib/navigation.ts",
  "src/components/sidebar.tsx",
  "src/app/app/purchases/page.tsx"
].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");

const requiredPhrases = [
  "首页",
  "产品中心",
  "订单中心",
  "生产中心",
  "库存中心",
  "采购中心",
  "数据导入",
  "报表中心",
  "帮助中心",
  "系统设置",
  "采购管理",
  "采购入库",
  "耗材批次",
  "包装采购入库",
  "采购总金额",
  "入库总成本"
];

for (const phrase of requiredPhrases) {
  if (!files.includes(phrase)) throw new Error(`Navigation/purchase UI is missing phrase: ${phrase}`);
}

if (files.includes("鏂") || files.includes("鐢") || files.includes("閫")) {
  throw new Error("Navigation or purchase UI still contains mojibake Chinese text.");
}

console.log("Navigation and purchase UI assertions passed.");
