import { existsSync } from "node:fs";
import { gettingStartedSteps, helpCategories, helpTopics } from "../src/lib/help-content";
import { navigationGroups } from "../src/lib/navigation";

const navigationItems = navigationGroups.flatMap(group => group.items);
const topicKeys = new Set(helpTopics.map(topic => topic.key));
const missingTopics = navigationItems.filter(item => !topicKeys.has(item.helpKey));
const duplicateKeys = helpTopics.map(topic => topic.key).filter((key, index, keys) => keys.indexOf(key) !== index);
const missingRoutes = helpTopics.filter(topic => {
  if (topic.route.startsWith("/app/help/")) return false;
  const route = topic.route.replace(/^\/app\//, "");
  return !existsSync(`src/app/app/${route}/page.tsx`);
});

const requiredHelpPages = [
  "getting-started",
  "setup",
  "products",
  "materials",
  "production",
  "orders",
  "after-sales",
  "reports",
  "pdd-import",
  "faq"
];
const missingHelpPages = requiredHelpPages.filter(slug => !existsSync(`src/app/app/help/${slug}/page.tsx`));
const missingHelpCategories = requiredHelpPages.filter(slug => !helpCategories.some(category => category.href === `/app/help/${slug}`));
const gettingStartedComplete = gettingStartedSteps.length === 14
  && gettingStartedSteps[0]?.title.includes("创建商家空间")
  && gettingStartedSteps[13]?.title.includes("查看利润报表");

const faq = helpTopics.find(topic => topic.key === "help-faq");
const faqText = JSON.stringify(faq ?? {});
const requiredFaqPhrases = ["实际到账金额", "耗材采购批次", "SKU 必须设置 BOM", "库存不能直接手动改", "打印失败成本", "售后补发", "拼多多订单", "区分产品和 SKU", "某个 SKU 是否赚钱", "每天、每周、每月利润"];
const missingFaq = requiredFaqPhrases.filter(phrase => !faqText.includes(phrase));

const pdd = helpTopics.find(topic => topic.key === "help-pdd-import");
const pddText = JSON.stringify(pdd ?? {});
const missingPddTables = ["订单明细表", "货款明细表", "售后退款表", "推广费用表", "快递费用表", "商品 / SKU 表"].filter(name => !pddText.includes(name));

if (missingTopics.length || duplicateKeys.length || missingRoutes.length || missingHelpPages.length || missingHelpCategories.length || !gettingStartedComplete || missingFaq.length || missingPddTables.length) {
  if (missingTopics.length) console.error("缺少帮助主题：", missingTopics.map(item => `${item.label} (${item.helpKey})`).join(", "));
  if (duplicateKeys.length) console.error("重复帮助主题：", duplicateKeys.join(", "));
  if (missingRoutes.length) console.error("帮助主题指向不存在页面：", missingRoutes.map(topic => `${topic.title} (${topic.route})`).join(", "));
  if (missingHelpPages.length) console.error("缺少帮助中心教程页面：", missingHelpPages.join(", "));
  if (missingHelpCategories.length) console.error("缺少帮助中心栏目配置：", missingHelpCategories.join(", "));
  if (!gettingStartedComplete) console.error("新手入门必须包含 14 个步骤，并覆盖创建商家空间到查看利润报表。");
  if (missingFaq.length) console.error("FAQ 缺少问题：", missingFaq.join(", "));
  if (missingPddTables.length) console.error("拼多多导入教程缺少表格说明：", missingPddTables.join(", "));
  process.exit(1);
}

console.log(`Help coverage passed: ${navigationItems.length} menu items, ${helpTopics.length} help topics, ${requiredHelpPages.length} tutorial pages`);
