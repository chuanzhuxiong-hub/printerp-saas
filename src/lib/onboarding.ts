import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type OnboardingStatusFlags = {
  shopCreated: boolean;
  productCreated: boolean;
  skuCreated: boolean;
  materialCreated: boolean;
  supplierCreated: boolean;
  purchaseBatchCreated: boolean;
  bomConfigured: boolean;
  stockAlertConfigured: boolean;
  orderCreated: boolean;
  productionTaskCreated: boolean;
};

export type OnboardingStatus = {
  status: OnboardingStatusFlags;
  completed: number;
  total: number;
  isComplete: boolean;
};

export const onboardingItems = [
  { key: "shopCreated", label: "已添加店铺", href: "/app/settings/shops/new", hint: "先建立拼多多、淘宝、抖音、线下等销售渠道。" },
  { key: "productCreated", label: "已添加产品", href: "/app/products/new", hint: "产品是 SPU，例如多肉花盆、笔筒、摆件。" },
  { key: "skuCreated", label: "已添加 SKU", href: "/app/products", hint: "SKU 是销售、库存、生产和利润核算对象。" },
  { key: "materialCreated", label: "已添加耗材", href: "/app/settings/materials/new", hint: "维护 PLA、PETG、ABS、TPU 等耗材资料。" },
  { key: "supplierCreated", label: "已添加供应商", href: "/app/settings/suppliers/new", hint: "记录耗材、包装、配件供应商。" },
  { key: "purchaseBatchCreated", label: "已录入采购批次", href: "/app/purchases/new", hint: "采购入库后系统才能计算每克成本。" },
  { key: "bomConfigured", label: "已设置 BOM / 打印配方", href: "/app/boms/new", hint: "设置理论克重、打印时间、损耗和包装成本。" },
  { key: "stockAlertConfigured", label: "已设置库存警戒线", href: "/app/inventory", hint: "低于警戒线时提醒补货或安排生产。" },
  { key: "orderCreated", label: "已录入或导入订单", href: "/app/orders/import", hint: "可以手工录入，也可以导入平台订单表。" },
  { key: "productionTaskCreated", label: "已创建生产任务", href: "/app/production/new", hint: "记录打印机、耗材、完成数量和失败数量。" }
] as const satisfies readonly { key: keyof OnboardingStatusFlags; label: string; href: string; hint: string }[];

export async function getOnboardingStatus(tenantId: string): Promise<OnboardingStatus> {
  const [
    shopCreated,
    productCreated,
    skuCreated,
    materialCreated,
    supplierCreated,
    purchaseBatchCreated,
    bomConfigured,
    skuStockAlertConfigured,
    inventoryStockAlertConfigured,
    orderCreated,
    productionTaskCreated
  ] = await Promise.all([
    db.shop.count({ where: { tenantId, deletedAt: null } }),
    db.product.count({ where: { tenantId, deletedAt: null } }),
    db.productSku.count({ where: { tenantId, deletedAt: null } }),
    db.material.count({ where: { tenantId, deletedAt: null } }),
    db.supplier.count({ where: { tenantId, deletedAt: null } }),
    db.materialBatch.count({ where: { tenantId, deletedAt: null } }),
    db.productBom.count({ where: { tenantId, deletedAt: null } }),
    db.productSku.count({ where: { tenantId, deletedAt: null, warningStock: { gt: new Prisma.Decimal(0) } } }),
    db.inventoryItem.count({ where: { tenantId, deletedAt: null, warningStock: { gt: new Prisma.Decimal(0) } } }),
    db.salesOrder.count({ where: { tenantId, deletedAt: null } }),
    db.productionOrder.count({ where: { tenantId, deletedAt: null } })
  ]);

  const status: OnboardingStatusFlags = {
    shopCreated: shopCreated > 0,
    productCreated: productCreated > 0,
    skuCreated: skuCreated > 0,
    materialCreated: materialCreated > 0,
    supplierCreated: supplierCreated > 0,
    purchaseBatchCreated: purchaseBatchCreated > 0,
    bomConfigured: bomConfigured > 0,
    stockAlertConfigured: skuStockAlertConfigured > 0 || inventoryStockAlertConfigured > 0,
    orderCreated: orderCreated > 0,
    productionTaskCreated: productionTaskCreated > 0
  };
  const total = onboardingItems.length;
  const completed = onboardingItems.filter(item => status[item.key]).length;
  return { status, completed, total, isComplete: completed === total };
}


