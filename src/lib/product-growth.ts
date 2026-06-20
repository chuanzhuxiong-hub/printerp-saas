import { Prisma } from "@prisma/client";

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function titleCandidates(input: { productName: string; keywords: string[]; sellingPoints: string[]; platform: string }) {
  const keywords = input.keywords.filter(Boolean);
  const points = input.sellingPoints.filter(Boolean);
  const candidates = [
    `${input.productName} ${keywords.slice(0, 3).join(" ")} ${points.slice(0, 2).join(" ")}`,
    `${points[0] ?? "实用"}${input.productName} ${keywords.slice(0, 4).join(" ")}`,
    `${input.productName} ${points.join(" ")} 适用${keywords.slice(0, 2).join(" ")}`
  ].map(title => title.replace(/\s+/g, " ").trim());
  return candidates.map((title, index) => ({
    title,
    score: clamp(65 + keywords.filter(word => title.includes(word)).length * 5 + points.filter(word => title.includes(word)).length * 4 - index * 2),
    riskNotes: title.length > 60 ? "标题偏长，请核对平台长度限制" : ""
  }));
}

export function detailPlan(input: { productName: string; keywords: string[]; sellingPoints: string[]; audience: string; scenarios: string }) {
  return [
    { module: "首屏卖点", content: `${input.productName}：${input.sellingPoints.slice(0, 3).join("、") || "突出核心价值"}` },
    { module: "适用场景", content: input.scenarios || "说明适用空间和使用方式" },
    { module: "目标人群", content: input.audience || "说明适合的目标用户" },
    { module: "核心卖点", content: input.sellingPoints.join("；") || "补充结构、材质、尺寸和使用体验" },
    { module: "关键词覆盖", content: input.keywords.join("、") || "补充搜索关键词" },
    { module: "3D 打印工艺", content: "说明层纹、材质特性、尺寸误差与使用注意事项，避免夸大宣传。" },
    { module: "FAQ", content: "尺寸、材质、颜色、清洁方式、售后与发货时效。" }
  ];
}

export function imagePlan(input: { productName: string; assetType: string; sellingPoints: string[]; platform: string }) {
  const planText = `${input.assetType}：主体清晰展示 ${input.productName}，突出${input.sellingPoints.slice(0, 3).join("、") || "结构与材质"}，保留真实尺寸和材质表现。`;
  const prompt = `${input.platform} 电商${input.assetType}，${input.productName}，${input.sellingPoints.join("，")}，真实产品比例，清晰光线，不夸大功能，不改变产品结构`;
  return { planText, prompt };
}

export function opportunityAnalysis(input: {
  price: Prisma.Decimal;
  estimatedCost: Prisma.Decimal;
  salesEstimate: Prisma.Decimal | null;
  reviewCount: number;
  competitorCount: number;
  printDifficultyScore: Prisma.Decimal;
  afterSaleRiskScore: Prisma.Decimal;
}) {
  const margin = input.price.gt(0) ? input.price.minus(input.estimatedCost).div(input.price) : new Prisma.Decimal(0);
  const demand = clamp((input.salesEstimate?.toNumber() ?? 0) / 10 + input.reviewCount / 20);
  const competitionFriendly = clamp(100 - input.competitorCount * 8);
  const marginScore = clamp(margin.toNumber() * 100);
  const printFriendly = clamp(100 - input.printDifficultyScore.toNumber());
  const riskFriendly = clamp(100 - input.afterSaleRiskScore.toNumber());
  const score = demand * 0.3 + marginScore * 0.25 + competitionFriendly * 0.2 + printFriendly * 0.15 + riskFriendly * 0.1;
  const recommendation = score >= 75 ? "建议立项打样" : score >= 55 ? "建议关注并补充成本、竞品数据" : "暂缓立项，优先寻找更高毛利或更低竞争方向";
  return { margin, demand, competitionFriendly, score: new Prisma.Decimal(score.toFixed(2)), recommendation };
}
