import { ChannelType, OrderStatus } from "@prisma/client";

export type ImportPlatform = "GENERIC" | "PINDUODUO" | "TAOBAO" | "SHOPIFY" | "ETSY";
export type ImportRow = Record<string, unknown>;

export type NormalizedOrderLine = {
  orderNo: string;
  skuCode: string;
  productName: string;
  specification: string;
  quantity: number;
  unitPrice: string;
  receivedAmount: string;
  shippingCost: string;
  packagingCost: string;
  platformFee: string;
  paymentFee: string;
  adCost: string;
  productCost: string;
  shopName: string;
  customerName: string;
  customerRegion: string;
  orderedAt: Date | null;
  paidAt: Date | null;
  status: OrderStatus;
  remark: string;
};

type TextField = Exclude<keyof NormalizedOrderLine, "quantity" | "orderedAt" | "paidAt" | "status">;
type ImportField = TextField | "quantity" | "orderedAt" | "paidAt" | "status";
type Aliases = Partial<Record<ImportField, string[]>>;

const commonAliases: Aliases = {
  orderNo: ["订单号", "orderNo", "Order No", "Order ID", "Name"],
  skuCode: ["SKU编码", "skuCode", "SKU", "商品SKU", "商家编码"],
  quantity: ["数量", "quantity", "Quantity", "Lineitem quantity"],
  unitPrice: ["商品单价", "unitPrice", "Price", "Lineitem price"],
  receivedAmount: ["实收金额", "receivedAmount", "Total", "Order Total"],
  shippingCost: ["快递成本", "shippingCost"],
  packagingCost: ["包装成本", "packagingCost"],
  platformFee: ["平台佣金", "platformFee"],
  paymentFee: ["支付手续费", "paymentFee"],
  adCost: ["广告成本", "adCost"],
  productCost: ["产品成本", "productCost"],
  shopName: ["店铺", "shopName", "Shop"],
  customerName: ["客户名称", "customerName", "Buyer", "Shipping Name"],
  customerRegion: ["客户地区", "customerRegion", "Province", "Shipping Province"],
  orderedAt: ["下单时间", "orderedAt", "Created at", "Order Date"],
  paidAt: ["付款时间", "paidAt", "Paid at"],
  status: ["订单状态", "status", "Financial Status", "Status"],
  remark: ["备注", "remark", "Notes"]
};

const platformAliases: Record<ImportPlatform, Aliases> = {
  GENERIC: {},
  PINDUODUO: {
    orderNo: ["订单号", "订单编号"],
    skuCode: ["商家编码-规格维度", "商家编码", "商品规格编码", "样式ID"],
    quantity: ["商品数量(件)", "商品数量", "数量"],
    unitPrice: ["商品总价(元)", "商品单价", "商品价格"],
    receivedAmount: ["商家实收金额(元)", "商家实收金额", "实收金额", "订单应收金额"],
    customerRegion: ["省", "收货省份"],
    orderedAt: ["订单成交时间", "订单创建时间", "下单时间"],
    paidAt: ["支付时间", "付款时间"],
    status: ["订单状态"]
  },
  TAOBAO: {
    orderNo: ["订单编号", "主订单编号", "订单号"],
    skuCode: ["商家编码", "SKU编码"],
    quantity: ["购买数量", "数量"],
    unitPrice: ["商品价格", "单价"],
    receivedAmount: ["买家实际支付金额", "实收金额"],
    customerName: ["收货人姓名", "买家会员名"],
    customerRegion: ["收货地址", "省"],
    orderedAt: ["订单创建时间", "下单时间"],
    paidAt: ["订单付款时间", "付款时间"],
    status: ["订单状态"]
  },
  SHOPIFY: {
    orderNo: ["Name", "Order ID"],
    skuCode: ["Lineitem sku", "SKU"],
    quantity: ["Lineitem quantity", "Quantity"],
    unitPrice: ["Lineitem price", "Price"],
    receivedAmount: ["Total", "Amount"],
    customerName: ["Shipping Name", "Billing Name"],
    customerRegion: ["Shipping Province", "Shipping Country"],
    orderedAt: ["Created at"],
    paidAt: ["Paid at"],
    status: ["Financial Status"]
  },
  ETSY: {
    orderNo: ["Order ID", "Receipt ID"],
    skuCode: ["SKU"],
    quantity: ["Quantity"],
    unitPrice: ["Price"],
    receivedAmount: ["Order Total", "Total"],
    customerName: ["Buyer", "Name"],
    customerRegion: ["Ship State", "Ship Country"],
    orderedAt: ["Order Date", "Sale Date"],
    status: ["Status"]
  }
};

export const importPlatformOptions: Array<{ value: ImportPlatform; label: string; channel: ChannelType; description: string }> = [
  { value: "GENERIC", label: "通用模板", channel: ChannelType.MANUAL, description: "PrintERP 标准 CSV / Excel 字段" },
  { value: "PINDUODUO", label: "拼多多", channel: ChannelType.PINDUODUO, description: "拼多多后台订单导出文件" },
  { value: "TAOBAO", label: "淘宝", channel: ChannelType.TAOBAO, description: "淘宝后台订单导出文件" },
  { value: "SHOPIFY", label: "Shopify", channel: ChannelType.SHOPIFY, description: "Shopify Orders CSV" },
  { value: "ETSY", label: "Etsy", channel: ChannelType.ETSY, description: "Etsy Orders CSV" }
];

function value(row: ImportRow, aliases: string[]) {
  for (const key of aliases) {
    const found = row[key];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).replace(/\t/g, "").trim();
  }
  return "";
}

function aliasesFor(platform: ImportPlatform, field: ImportField) {
  return [...(platformAliases[platform][field] ?? []), ...(commonAliases[field] ?? [])];
}

function parseDate(input: string) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePinduoduoOrderDate(orderNo: string) {
  const match = orderNo.match(/^(\d{2})(\d{2})(\d{2})-/);
  if (!match) return null;
  const date = new Date(`20${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapStatus(input: string) {
  const status = input.trim().toLowerCase();
  if (!status) return OrderStatus.PAID;
  if (["pending", "unpaid", "待付款", "等待买家付款"].some(item => status.includes(item))) return OrderStatus.PENDING_PAYMENT;
  if (["cancel", "void", "关闭", "取消"].some(item => status.includes(item))) return OrderStatus.CANCELLED;
  if (["refund", "退款"].some(item => status.includes(item))) return OrderStatus.REFUNDED;
  if (["complete", "fulfilled", "交易成功", "完成"].some(item => status.includes(item))) return OrderStatus.COMPLETED;
  if (["shipped", "已发货", "卖家已发货"].some(item => status.includes(item))) return OrderStatus.SHIPPED;
  return OrderStatus.PAID;
}

export function normalizeOrderRow(row: ImportRow, platform: ImportPlatform): NormalizedOrderLine {
  const get = (field: ImportField) => value(row, aliasesFor(platform, field));
  const quantity = Number.parseInt(get("quantity") || "1", 10);
  const productName = value(row, ["商品", "商品名称", "Product", "Lineitem name"]);
  const specification = value(row, ["商品规格", "规格", "Variant", "Lineitem variant"]);
  const rawSkuCode = get("skuCode");
  const skuCode = platform === "PINDUODUO" && rawSkuCode && /^\d+$/.test(rawSkuCode) ? `PDD-${rawSkuCode}` : rawSkuCode;
  const rawUnitPrice = get("unitPrice");
  const unitPrice = platform === "PINDUODUO" && rawUnitPrice && quantity > 1 ? String(Number(rawUnitPrice) / quantity) : rawUnitPrice;
  return {
    orderNo: get("orderNo"),
    skuCode,
    productName,
    specification,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unitPrice,
    receivedAmount: get("receivedAmount"),
    shippingCost: get("shippingCost"),
    packagingCost: get("packagingCost"),
    platformFee: get("platformFee"),
    paymentFee: get("paymentFee"),
    adCost: get("adCost"),
    productCost: get("productCost"),
    shopName: get("shopName"),
    customerName: get("customerName"),
    customerRegion: get("customerRegion"),
    orderedAt: parseDate(get("orderedAt")) ?? (platform === "PINDUODUO" ? parsePinduoduoOrderDate(get("orderNo")) : null),
    paidAt: parseDate(get("paidAt")),
    status: mapStatus(get("status")),
    remark: get("remark")
  };
}

export function detectImportPlatform(rows: ImportRow[], selected: ImportPlatform) {
  if (selected !== "GENERIC" || !rows.length) return selected;
  const fields = new Set(Object.keys(rows[0]));
  if (fields.has("样式ID") && fields.has("商家实收金额(元)") && fields.has("订单成交时间")) return "PINDUODUO";
  if (fields.has("Lineitem sku") && fields.has("Financial Status")) return "SHOPIFY";
  if (fields.has("Receipt ID") || fields.has("Sale Date")) return "ETSY";
  if (fields.has("主订单编号") || fields.has("买家实际支付金额")) return "TAOBAO";
  return selected;
}

export function getImportPlatform(input: FormDataEntryValue | null): ImportPlatform {
  const value = String(input ?? "GENERIC").toUpperCase();
  return importPlatformOptions.some(item => item.value === value) ? value as ImportPlatform : "GENERIC";
}

export function channelForPlatform(platform: ImportPlatform) {
  return importPlatformOptions.find(item => item.value === platform)?.channel ?? ChannelType.MANUAL;
}
