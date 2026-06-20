import { Prisma } from "@prisma/client";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { CostImportRow, getCostImportType, isValidCostAmount, normalizeCostRow } from "@/lib/cost-import";
import { calculateOrderProfit } from "@/lib/profit";
import { readXlsxRows } from "@/lib/spreadsheet";

export async function importCostsFromBytes(input: {
  tenantId: string;
  userId?: string | null;
  fileName: string;
  bytes: ArrayBuffer;
  type: string;
}) {
  const type = getCostImportType(input.type);
  let rows: CostImportRow[];
  if (input.fileName.toLowerCase().endsWith(".csv")) {
    const parsed = Papa.parse<CostImportRow>(new TextDecoder().decode(input.bytes), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);
    rows = parsed.data;
  } else if (input.fileName.toLowerCase().endsWith(".xlsx")) {
    rows = await readXlsxRows<CostImportRow>(input.bytes);
  } else {
    throw new Error("仅支持 CSV 和 XLSX 文件；旧版 XLS 请先另存为 XLSX");
  }
  if (!rows.length) throw new Error("文件中没有费用数据");
  if (rows.length > 5000) throw new Error("单次最多导入 5000 行费用");

  const normalized = rows.map(normalizeCostRow);
  const valid = normalized.filter(row => row.orderNo && isValidCostAmount(row.amount));
  if (!valid.length) throw new Error("未识别到有效的订单号和金额字段");

  const grouped = new Map<string, { amount: Prisma.Decimal; details: typeof valid }>();
  for (const row of valid) {
    const current = grouped.get(row.orderNo) ?? { amount: new Prisma.Decimal(0), details: [] };
    current.amount = current.amount.plus(row.amount);
    current.details.push(row);
    grouped.set(row.orderNo, current);
  }

  const orders = await db.salesOrder.findMany({
    where: { tenantId: input.tenantId, orderNo: { in: [...grouped.keys()] }, deletedAt: null }
  });
  const sourceType = type === "SHIPPING" ? "ShippingBillImport" : "AdvertisingCostImport";
  let matched = 0;
  const unmatched = grouped.size - orders.length;
  const invalid = rows.length - valid.length;

  await db.$transaction(async tx => {
    for (const order of orders) {
      const group = grouped.get(order.orderNo)!;
      const changedCost = type === "SHIPPING" ? { shippingCost: group.amount } : { adCost: group.amount };
      const profit = calculateOrderProfit({ ...order, ...changedCost });
      await tx.salesOrder.update({ where: { id: order.id }, data: { ...changedCost, ...profit, updatedBy: input.userId ?? undefined } });
      await tx.costRecord.deleteMany({ where: { tenantId: input.tenantId, sourceType, salesOrderId: order.id } });

      const detail = group.details[0];
      const remark = [
        `文件：${input.fileName}`,
        detail.provider && `来源：${detail.provider}`,
        detail.referenceNo && `参考号：${detail.referenceNo}`,
        detail.remark
      ].filter(Boolean).join("；");
      await tx.costRecord.create({
        data: {
          tenantId: input.tenantId,
          sourceType,
          sourceId: order.id,
          salesOrderId: order.id,
          amount: group.amount,
          remark,
          createdBy: input.userId ?? undefined
        }
      });
      matched++;
    }
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? undefined,
        action: type === "SHIPPING" ? "shipping-bill.imported" : "advertising-cost.imported",
        entityType: "CostImport",
        metadata: { type, fileName: input.fileName, matched, unmatched, invalid, sourceRows: rows.length }
      }
    });
  });

  return { type, matched, unmatched, invalid, sourceRows: rows.length };
}
