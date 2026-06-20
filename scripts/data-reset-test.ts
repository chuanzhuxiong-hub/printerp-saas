import { PrismaClient } from "@prisma/client";
import { resetTenantData } from "../src/lib/data-reset";

const db = new PrismaClient();
const rollback = new Error("EXPECTED_ROLLBACK");

async function run(scope: "OPERATIONS" | "ALL") {
  try {
    await db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name: `Reset Test ${scope}`, slug: `reset-test-${scope.toLowerCase()}-${Date.now()}` } });
      const channel = await tx.salesChannel.create({ data: { tenantId: tenant.id, name: "测试渠道", type: "MANUAL" } });
      const shop = await tx.shop.create({ data: { tenantId: tenant.id, salesChannelId: channel.id, name: "测试店铺" } });
      const product = await tx.product.create({ data: { tenantId: tenant.id, name: "测试产品" } });
      const sku = await tx.productSku.create({ data: { tenantId: tenant.id, productId: product.id, skuCode: `SKU-${scope}`, name: "测试 SKU", salePrice: 10 } });
      await tx.salesOrder.create({ data: { tenantId: tenant.id, shopId: shop.id, orderNo: `SO-${scope}`, items: { create: [{ tenantId: tenant.id, skuId: sku.id, skuName: sku.name, quantity: 1, unitPrice: 10, saleAmount: 10 }] } } });
      await tx.inventoryItem.create({ data: { tenantId: tenant.id, category: "PRODUCT", refId: sku.id, name: sku.name, quantity: 1 } });
      await tx.expense.create({ data: { tenantId: tenant.id, name: "测试费用", amount: 1 } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, action: "test", entityType: "Tenant", entityId: tenant.id } });

      await resetTenantData(tx, tenant.id, scope);

      const operationalCounts = await Promise.all([
        tx.salesOrder.count({ where: { tenantId: tenant.id } }),
        tx.inventoryItem.count({ where: { tenantId: tenant.id } }),
        tx.expense.count({ where: { tenantId: tenant.id } }),
        tx.auditLog.count({ where: { tenantId: tenant.id } })
      ]);
      if (operationalCounts.some(count => count !== 0)) throw new Error(`${scope} 未清空经营数据`);
      const masterCount = await tx.product.count({ where: { tenantId: tenant.id } });
      if (scope === "OPERATIONS" && masterCount !== 1) throw new Error("清空经营数据错误删除了基础资料");
      if (scope === "ALL" && masterCount !== 0) throw new Error("全部初始化未删除基础资料");
      if (await tx.tenant.count({ where: { id: tenant.id } }) !== 1) throw new Error("初始化错误删除了商家空间");
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function main() {
  await run("OPERATIONS");
  await run("ALL");
  console.log("Data reset passed: operational scope preserves master data, all scope clears business data, tenant preserved");
}

main().finally(() => db.$disconnect());
