import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/http";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function csv(headers: string[], rows: unknown[][]) {
  return "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  const auth = await requireApiSession(request);
  if (!auth.session) return auth.response;
  const tenantId = auth.session.tenantId;
  const resource = new URL(request.url).searchParams.get("resource") ?? "orders";
  let fileName = resource;
  let output: string;
  if (resource === "inventory") {
    const rows = await db.inventoryItem.findMany({ where: { tenantId, deletedAt: null }, orderBy: { category: "asc" } });
    output = csv(["分类", "名称", "当前库存", "锁定库存", "警戒线", "单位成本"], rows.map(row => [row.category, row.name, row.quantity, row.lockedQuantity, row.warningStock, row.unitCost]));
  } else if (resource === "expenses") {
    const rows = await db.expense.findMany({ where: { tenantId, deletedAt: null }, orderBy: { occurredAt: "desc" } });
    output = csv(["日期", "名称", "金额", "备注"], rows.map(row => [row.occurredAt.toISOString(), row.name, row.amount, row.remark]));
  } else if (resource === "audit") {
    const rows = await db.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 10000 });
    output = csv(["时间", "动作", "实体类型", "实体ID", "用户ID", "元数据"], rows.map(row => [row.createdAt.toISOString(), row.action, row.entityType, row.entityId, row.userId, JSON.stringify(row.metadata)]));
  } else {
    fileName = "orders";
    const rows = await db.salesOrder.findMany({ where: { tenantId, deletedAt: null }, orderBy: { orderedAt: "desc" } });
    output = csv(["订单号", "渠道", "下单时间", "实收", "产品成本", "快递成本", "包装成本", "广告成本", "售后成本", "毛利", "净利", "状态"], rows.map(row => [row.orderNo, row.channel, row.orderedAt.toISOString(), row.receivedAmount, row.productCost, row.shippingCost, row.packagingCost, row.adCost, row.afterSaleCost, row.grossProfit, row.netProfit, row.status]));
  }
  return new NextResponse(output, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="printerp-${fileName}-${new Date().toISOString().slice(0, 10)}.csv"` }
  });
}
