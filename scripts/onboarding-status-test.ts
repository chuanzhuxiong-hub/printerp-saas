import { PrismaClient } from "@prisma/client";
import { getOnboardingStatus } from "../src/lib/onboarding";

const db = new PrismaClient();

async function createTenant(slug: string) {
  return db.tenant.create({
    data: { name: `Onboarding Test ${slug}`, slug, contactName: "Test Owner" }
  });
}

async function main() {
  const suffix = Date.now();
  const emptyTenant = await createTenant(`onboarding-empty-${suffix}`);
  const fullTenant = await createTenant(`onboarding-full-${suffix}`);

  const empty = await getOnboardingStatus(emptyTenant.id);
  const expectedEmpty = {
    shopCreated: false,
    productCreated: false,
    skuCreated: false,
    materialCreated: false,
    supplierCreated: false,
    purchaseBatchCreated: false,
    bomConfigured: false,
    stockAlertConfigured: false,
    orderCreated: false,
    productionTaskCreated: false
  };
  if (JSON.stringify(empty.status) !== JSON.stringify(expectedEmpty) || empty.completed !== 0 || empty.total !== 10 || empty.isComplete) {
    throw new Error(`Empty tenant onboarding status mismatch: ${JSON.stringify(empty)}`);
  }

  const shop = await db.shop.create({ data: { tenantId: fullTenant.id, name: "拼多多主店" } });
  const supplier = await db.supplier.create({ data: { tenantId: fullTenant.id, name: "PLA 耗材供应商" } });
  const material = await db.material.create({
    data: { tenantId: fullTenant.id, defaultSupplierId: supplier.id, name: "PLA 哑光白", type: "PLA", color: "白色", brand: "TestFilament", warningStock: "1000" }
  });
  const product = await db.product.create({ data: { tenantId: fullTenant.id, name: "3D 打印多肉花盆" } });
  const sku = await db.productSku.create({
    data: { tenantId: fullTenant.id, productId: product.id, skuCode: `ONBOARDING-SKU-${suffix}`, name: "白色小号", salePrice: "39.90", warningStock: "10" }
  });
  await db.materialBatch.create({
    data: {
      tenantId: fullTenant.id,
      materialId: material.id,
      supplierId: supplier.id,
      batchNo: `ONBOARDING-BATCH-${suffix}`,
      purchaseGrams: "1000",
      purchaseAmount: "60",
      totalCost: "66",
      costPerGram: "0.066",
      remainingGrams: "1000"
    }
  });
  await db.productBom.create({
    data: { tenantId: fullTenant.id, skuId: sku.id, defaultMaterialId: material.id, theoreticalGrams: "80", estimatedPrintHours: "2.5" }
  });
  await db.salesOrder.create({
    data: { tenantId: fullTenant.id, shopId: shop.id, orderNo: `ONBOARDING-ORDER-${suffix}`, receivedAmount: "39.90", itemSaleAmount: "39.90" }
  });
  await db.productionOrder.create({
    data: { tenantId: fullTenant.id, orderNo: `ONBOARDING-PROD-${suffix}`, skuId: sku.id, plannedQuantity: 1 }
  });

  const full = await getOnboardingStatus(fullTenant.id);
  if (!full.isComplete || full.completed !== 10 || full.total !== 10) {
    throw new Error(`Full tenant onboarding status mismatch: ${JSON.stringify(full)}`);
  }

  const emptyAgain = await getOnboardingStatus(emptyTenant.id);
  if (emptyAgain.completed !== 0 || emptyAgain.isComplete) {
    throw new Error(`Onboarding status leaked across tenants: ${JSON.stringify(emptyAgain)}`);
  }

  console.log("Onboarding status passed: empty tenant, complete tenant, tenant isolation");
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
