import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/http";

function csv(headers: string[], sample: string[]) {
  const cell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
  return "\uFEFF" + [headers, sample].map(row => row.map(cell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  const auth = await requireApiSession(request);
  if (!auth.session) return auth.response;
  const type = new URL(request.url).searchParams.get("type") ?? "competitors";
  const competitors = type === "competitors";
  const output = competitors
    ? csv(
        ["platform", "competitorUrl", "competitorProductId", "title", "mainImageUrl", "shopName", "currentPrice", "originalPrice", "salesDisplayValue", "salesEstimate", "salesActual", "reviewCount", "activityInfo", "specification"],
        ["拼多多", "https://example.com/item/123", "123", "示例竞品", "", "示例店铺", "29.90", "39.90", "已拼1万+", "10000", "", "500", "满减活动", "标准款"]
      )
    : csv(
        ["keyword", "platform", "title", "productUrl", "category", "shopName", "price", "salesDisplayValue", "salesEstimate", "salesActual", "reviewCount", "competitorCount", "estimatedCost", "printDifficultyScore", "afterSaleRiskScore"],
        ["桌面收纳", "拼多多", "示例候选商品", "https://example.com/item/456", "收纳", "示例店铺", "39.90", "已售5000+", "5000", "", "100", "5", "10", "20", "10"]
      );
  return new NextResponse(output, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="printerp-${competitors ? "competitors" : "opportunities"}-template.csv"`
    }
  });
}
