export type CostImportType = "SHIPPING" | "ADVERTISING";
export type CostImportRow = Record<string, unknown>;

export type NormalizedCostRow = {
  orderNo: string;
  amount: string;
  referenceNo: string;
  provider: string;
  remark: string;
};

const aliases = {
  orderNo: ["订单号", "订单编号", "orderNo", "Order No", "Order ID"],
  amount: ["金额", "费用", "快递费", "运费", "广告费", "消耗金额", "amount", "Amount", "Cost", "Spend"],
  referenceNo: ["运单号", "账单号", "广告计划ID", "referenceNo", "Tracking No", "Campaign ID"],
  provider: ["快递公司", "广告平台", "渠道", "provider", "Carrier", "Platform"],
  remark: ["备注", "remark", "Notes"]
};

function value(row: CostImportRow, keys: string[]) {
  for (const key of keys) {
    const found = row[key];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).trim();
  }
  return "";
}

export function normalizeCostRow(row: CostImportRow): NormalizedCostRow {
  return {
    orderNo: value(row, aliases.orderNo),
    amount: value(row, aliases.amount).replace(/[,￥¥$]/g, ""),
    referenceNo: value(row, aliases.referenceNo),
    provider: value(row, aliases.provider),
    remark: value(row, aliases.remark)
  };
}

export function getCostImportType(input: FormDataEntryValue | null): CostImportType {
  return String(input ?? "").toUpperCase() === "ADVERTISING" ? "ADVERTISING" : "SHIPPING";
}

export function isValidCostAmount(input: string) {
  return /^\d+(\.\d{1,4})?$/.test(input);
}
