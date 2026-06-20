import { PrismaClient, UserRole, ChannelType, InventoryCategory, InventoryTransactionType, MaterialType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("PrintERP123!", 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-3d-print-studio" },
    update: {},
    create: {
      name: "Demo 3D 打印工作室",
      slug: "demo-3d-print-studio",
      contactName: "老板"
    }
  });

  const user = await prisma.user.upsert({
    where: { email: "owner@demo.printerp.local" },
    update: { passwordHash },
    create: {
      email: "owner@demo.printerp.local",
      name: "Demo Owner",
      passwordHash
    }
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: UserRole.OWNER },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: UserRole.OWNER
    }
  });

  const channel = await prisma.salesChannel.findFirst({ where: { tenantId: tenant.id, name: "鎵嬪伐璁㈠崟" } }) ?? await prisma.salesChannel.create({
    data: {
      tenantId: tenant.id,
      name: "手工订单",
      type: ChannelType.MANUAL
    }
  });

  const shop = await prisma.shop.findFirst({ where: { tenantId: tenant.id, name: "绾夸笅宸ヤ綔瀹?" } }) ?? await prisma.shop.create({
    data: {
      tenantId: tenant.id,
      salesChannelId: channel.id,
      name: "线下工作室",
      contactName: "店长"
    }
  });

  const supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: "PLA 鑰楁潗渚涘簲鍟?" } }) ?? await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: "PLA 耗材供应商",
      contact: "张三"
    }
  });

  const material = await prisma.material.findFirst({ where: { tenantId: tenant.id, name: "PLA 鍝戝厜鐧?" } }) ?? await prisma.material.create({
    data: {
      tenantId: tenant.id,
      defaultSupplierId: supplier.id,
      name: "PLA 哑光白",
      type: MaterialType.PLA,
      color: "白色",
      brand: "DemoFilament",
      warningStock: "1000"
    }
  });

  const box = await prisma.packagingItem.findFirst({ where: { tenantId: tenant.id, name: "灏忓彿绾哥" } }) ?? await prisma.packagingItem.create({
    data: {
      tenantId: tenant.id,
      name: "小号纸箱",
      spec: "120x120x120mm",
      unit: "个",
      unitPrice: "0.85",
      quantity: "200",
      warningStock: "50"
    }
  });

  const printer = await prisma.printer.findUnique({ where: { tenantId_code: { tenantId: tenant.id, code: "P-001" } } }) ?? await prisma.printer.create({
    data: {
      tenantId: tenant.id,
      code: "P-001",
      name: "Bambu A1",
      model: "A1",
      purchasePrice: "2399",
      availableHours: "5000",
      depreciationPerHour: "0.48"
    }
  });

  const product = await prisma.product.findFirst({ where: { tenantId: tenant.id, name: "澶氳倝鑺辩泦" } }) ?? await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: "多肉花盆",
      category: "家居摆件"
    }
  });

  const sku = await prisma.productSku.upsert({
    where: { tenantId_skuCode: { tenantId: tenant.id, skuCode: "POT-WHITE-S" } },
    update: {},
    create: {
      tenantId: tenant.id,
      productId: product.id,
      skuCode: "POT-WHITE-S",
      name: "多肉花盆-白色-小号",
      color: "白色",
      size: "小号",
      material: "PLA",
      salePrice: "39.90",
      warningStock: "10"
    }
  });

  await prisma.materialBatch.upsert({
    where: { tenantId_batchNo: { tenantId: tenant.id, batchNo: "MB-20260608-001" } },
    update: {
      materialId: material.id,
      supplierId: supplier.id,
      purchaseGrams: "1000",
      purchaseAmount: "58",
      shippingFee: "6",
      taxFee: "0",
      discountAmount: "0",
      totalCost: "64",
      costPerGram: "0.064",
      remainingGrams: "1000",
      status: "NORMAL"
    },
    create: {
      tenantId: tenant.id,
      materialId: material.id,
      supplierId: supplier.id,
      batchNo: "MB-20260608-001",
      purchaseGrams: "1000",
      purchaseAmount: "58",
      shippingFee: "6",
      taxFee: "0",
      discountAmount: "0",
      totalCost: "64",
      costPerGram: "0.064",
      remainingGrams: "1000"
    }
  });

  await prisma.inventoryItem.createMany({
    data: [
      {
        tenantId: tenant.id,
        category: InventoryCategory.MATERIAL,
        refId: material.id,
        name: "PLA 哑光白",
        quantity: "1000",
        warningStock: "1000",
        unitCost: "0.064"
      },
      {
        tenantId: tenant.id,
        category: InventoryCategory.PACKAGING,
        refId: box.id,
        name: "小号纸箱",
        quantity: "200",
        warningStock: "50",
        unitCost: "0.85"
      },
      {
        tenantId: tenant.id,
        category: InventoryCategory.PRODUCT,
        refId: sku.id,
        name: "多肉花盆-白色-小号",
        quantity: "12",
        warningStock: "10",
        unitCost: "9.80"
      }
    ],
    skipDuplicates: true
  });

  const seededInventory = await prisma.inventoryItem.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { category: InventoryCategory.MATERIAL, refId: material.id },
        { category: InventoryCategory.PACKAGING, refId: box.id },
        { category: InventoryCategory.PRODUCT, refId: sku.id }
      ]
    }
  });
  for (const item of seededInventory) {
    const sourceId = `opening-balance:${item.id}`;
    const opening = await prisma.inventoryTransaction.findFirst({
      where: { tenantId: tenant.id, sourceType: "seed-opening", sourceId }
    });
    if (!opening && !item.quantity.eq(0)) {
      await prisma.inventoryTransaction.create({
        data: {
          tenantId: tenant.id,
          itemId: item.id,
          category: item.category,
          refId: item.refId,
          type: InventoryTransactionType.MANUAL_ADJUST,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity.mul(item.unitCost),
          sourceType: "seed-opening",
          sourceId,
          remark: "Seed opening balance"
        }
      });
    }
  }

  const seedTransaction = await prisma.inventoryTransaction.findFirst({
    where: { tenantId: tenant.id, category: InventoryCategory.MATERIAL, refId: material.id, sourceType: "seed" }
  });
  if (!seedTransaction) await prisma.inventoryTransaction.create({
    data: {
      tenantId: tenant.id,
      category: InventoryCategory.MATERIAL,
      refId: material.id,
      type: InventoryTransactionType.PURCHASE_IN,
      quantity: "1000",
      unitCost: "0.064",
      totalCost: "64",
      sourceType: "seed"
    }
  });

  await prisma.productBom.upsert({
    where: { skuId: sku.id },
    update: {
      defaultMaterialId: material.id,
      theoreticalGrams: "95",
      wasteGrams: "8",
      estimatedPrintHours: "2.4",
      laborMinutes: "8",
      laborCostPerMinute: "0.35",
      electricityCost: "0.70",
      estimatedProductCost: "9.80"
    },
    create: {
      tenantId: tenant.id,
      skuId: sku.id,
      defaultMaterialId: material.id,
      theoreticalGrams: "95",
      wasteGrams: "8",
      estimatedPrintHours: "2.4",
      laborMinutes: "8",
      laborCostPerMinute: "0.35",
      electricityCost: "0.70",
      estimatedProductCost: "9.80",
      items: {
        create: [
          {
            tenantId: tenant.id,
            category: InventoryCategory.PACKAGING,
            refId: box.id,
            quantity: "1",
            unitCost: "0.85",
            totalCost: "0.85"
          }
        ]
      }
    }
  });

  const order = await prisma.salesOrder.upsert({
    where: { tenantId_orderNo: { tenantId: tenant.id, orderNo: "SO-20260608-001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      shopId: shop.id,
      orderNo: "SO-20260608-001",
      channel: ChannelType.MANUAL,
      customerName: "示例客户",
      customerRegion: "广东",
      itemSaleAmount: "39.90",
      receivedAmount: "39.90",
      platformFee: "0",
      paymentFee: "0.30",
      adCost: "2.00",
      shippingCost: "5.00",
      packagingCost: "0.85",
      productCost: "9.80",
      grossProfit: "23.95",
      netProfit: "21.95",
      items: {
        create: [
          {
            tenantId: tenant.id,
            skuId: sku.id,
            skuName: sku.name,
            quantity: 1,
            unitPrice: "39.90",
            saleAmount: "39.90",
            productCost: "9.80"
          }
        ]
      }
    }
  });

  await prisma.productionOrder.upsert({
    where: { tenantId_orderNo: { tenantId: tenant.id, orderNo: "PO-20260608-001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      orderNo: "PO-20260608-001",
      salesOrderId: order.id,
      skuId: sku.id,
      printerId: printer.id,
      plannedQuantity: 1,
      completedQuantity: 1,
      actualMaterialGrams: "103",
      actualPrintHours: "2.5",
      actualCost: "9.80"
    }
  });

  const shipment = await prisma.shipment.findFirst({
    where: { tenantId: tenant.id, salesOrderId: order.id, trackingNo: "DEMO-TRACK-001" }
  });
  if (!shipment) {
    await prisma.shipment.create({
      data: {
        tenantId: tenant.id,
        salesOrderId: order.id,
        carrier: "Demo Express",
        trackingNo: "DEMO-TRACK-001",
        shippingCost: "5.00",
        packagingCost: "0.85",
        status: "SHIPPED",
        shippedAt: new Date(),
        items: {
          create: [{
            tenantId: tenant.id,
            category: InventoryCategory.PRODUCT,
            refId: sku.id,
            quantity: "1",
            unitCost: "9.80",
            totalCost: "9.80"
          }]
        }
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      action: "seed.initialized",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { demo: true }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
