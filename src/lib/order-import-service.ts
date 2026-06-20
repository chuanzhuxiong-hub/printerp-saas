import { InventoryCategory, Prisma } from "@prisma/client";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { calculateOrderProfit } from "@/lib/profit";
import { channelForPlatform, detectImportPlatform, getImportPlatform, ImportRow, normalizeOrderRow } from "@/lib/order-import";
import { readXlsxRows } from "@/lib/spreadsheet";

export async function importOrdersFromBytes(input: {
  tenantId: string;
  userId?: string | null;
  fileName: string;
  bytes: ArrayBuffer;
  platform: string;
}) {
  let platform = getImportPlatform(input.platform);
  let rows: ImportRow[];
  if (input.fileName.toLowerCase().endsWith(".csv")) {
    const parsed = Papa.parse<ImportRow>(new TextDecoder().decode(input.bytes), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);
    rows = parsed.data;
  } else if (input.fileName.toLowerCase().endsWith(".xlsx")) {
    rows = await readXlsxRows<ImportRow>(input.bytes);
  } else {
    throw new Error("仅支持 CSV 和 XLSX 文件；旧版 XLS 请先另存为 XLSX");
  }
  if (!rows.length) throw new Error("文件中没有订单数据");
  if (rows.length > 2000) throw new Error("单次最多导入 2000 行订单商品");

  platform = detectImportPlatform(rows, platform);
  const normalized = rows.map(row => normalizeOrderRow(row, platform));
  const validLines = normalized.filter(row => row.orderNo && row.skuCode);
  if (!validLines.length) throw new Error("未识别到订单号和 SKU 编码，请确认选择的平台与文件字段一致");

  const groups = new Map<string, typeof validLines>();
  for (const line of validLines) groups.set(line.orderNo, [...(groups.get(line.orderNo) ?? []), line]);
  const skuCodes = [...new Set(validLines.map(row => row.skuCode))];
  const orderNos = [...groups.keys()];
  const shopNames = [...new Set(validLines.map(row => row.shopName).filter(Boolean))];
  const missingSkuLines = validLines.filter((line, index, all) => all.findIndex(item => item.skuCode === line.skuCode) === index);
  const existingSkuCodes = new Set((await db.productSku.findMany({
    where: { tenantId: input.tenantId, skuCode: { in: skuCodes }, deletedAt: null },
    select: { skuCode: true }
  })).map(item => item.skuCode));
  let createdSkus = 0;
  if (platform === "PINDUODUO") {
    await db.$transaction(async tx => {
      for (const line of missingSkuLines.filter(item => !existingSkuCodes.has(item.skuCode))) {
        const productName = line.productName || "拼多多导入商品";
        let product = await tx.product.findFirst({ where: { tenantId: input.tenantId, name: productName, deletedAt: null } });
        if (!product) product = await tx.product.create({ data: { tenantId: input.tenantId, name: productName, category: "拼多多导入", createdBy: input.userId ?? undefined } });
        const sku = await tx.productSku.create({
          data: {
            tenantId: input.tenantId,
            productId: product.id,
            skuCode: line.skuCode,
            name: line.specification ? `${productName}-${line.specification}` : productName,
            salePrice: new Prisma.Decimal(line.unitPrice || line.receivedAmount || 0),
            remark: "由拼多多订单导入自动创建",
            createdBy: input.userId ?? undefined
          }
        });
        await tx.inventoryItem.create({
          data: { tenantId: input.tenantId, category: InventoryCategory.PRODUCT, refId: sku.id, name: sku.name, quantity: 0, warningStock: 0, unitCost: 0, createdBy: input.userId ?? undefined }
        });
        await tx.auditLog.create({
          data: { tenantId: input.tenantId, userId: input.userId ?? undefined, action: "sku.auto-created-from-order-import", entityType: "ProductSku", entityId: sku.id, metadata: { platform, specification: line.specification } }
        });
        createdSkus++;
      }
    });
  }
  const [skus, existingOrders, shops] = await Promise.all([
    db.productSku.findMany({ where: { tenantId: input.tenantId, skuCode: { in: skuCodes }, deletedAt: null }, include: { bom: true } }),
    db.salesOrder.findMany({ where: { tenantId: input.tenantId, orderNo: { in: orderNos }, deletedAt: null }, select: { orderNo: true } }),
    db.shop.findMany({ where: { tenantId: input.tenantId, name: { in: shopNames }, deletedAt: null } })
  ]);
  const productInventory = await db.inventoryItem.findMany({
    where: { tenantId: input.tenantId, category: InventoryCategory.PRODUCT, refId: { in: skus.map(item => item.id) }, deletedAt: null }
  });
  const missingSkus = skuCodes.filter(code => !skus.some(sku => sku.skuCode === code));
  if (missingSkus.length) throw new Error(`以下 SKU 未在系统中建立：${missingSkus.slice(0, 10).join("、")}`);

  const existingSet = new Set(existingOrders.map(item => item.orderNo));
  let imported = 0;
  let skipped = normalized.length - validLines.length;

  await db.$transaction(async tx => {
    for (const [orderNo, lines] of groups) {
      if (existingSet.has(orderNo)) {
        skipped++;
        continue;
      }
      const first = lines[0];
      const items = lines.map(line => {
        const sku = skus.find(item => item.skuCode === line.skuCode)!;
        const unitPrice = new Prisma.Decimal(line.unitPrice || sku.salePrice);
        const saleAmount = unitPrice.mul(line.quantity);
        const inventoryItem = productInventory.find(item => item.refId === sku.id);
        const productCost = new Prisma.Decimal(line.productCost || inventoryItem?.unitCost.mul(line.quantity) || sku.bom?.estimatedProductCost.mul(line.quantity) || 0);
        return { tenantId: input.tenantId, skuId: sku.id, skuName: sku.name, quantity: line.quantity, unitPrice, saleAmount, productCost };
      });
      const saleAmount = items.reduce((sum, item) => sum.plus(item.saleAmount), new Prisma.Decimal(0));
      const productCost = items.reduce((sum, item) => sum.plus(item.productCost), new Prisma.Decimal(0));
      const receivedAmount = new Prisma.Decimal(first.receivedAmount || saleAmount);
      const costs = {
        receivedAmount,
        productCost,
        shippingCost: new Prisma.Decimal(first.shippingCost || 0),
        packagingCost: new Prisma.Decimal(first.packagingCost || 0),
        platformFee: new Prisma.Decimal(first.platformFee || 0),
        paymentFee: new Prisma.Decimal(first.paymentFee || 0),
        afterSaleCost: new Prisma.Decimal(0),
        adCost: new Prisma.Decimal(first.adCost || 0)
      };
      const profit = calculateOrderProfit(costs);
      const shop = shops.find(item => item.name === first.shopName);
      await tx.salesOrder.create({
        data: {
          tenantId: input.tenantId,
          shopId: shop?.id,
          orderNo,
          channel: channelForPlatform(platform),
          customerName: first.customerName || null,
          customerRegion: first.customerRegion || null,
          orderedAt: first.orderedAt ?? undefined,
          paidAt: first.paidAt,
          status: first.status,
          itemSaleAmount: saleAmount,
          receivedAmount,
          productCost,
          shippingCost: costs.shippingCost,
          packagingCost: costs.packagingCost,
          platformFee: costs.platformFee,
          paymentFee: costs.paymentFee,
          adCost: costs.adCost,
          grossProfit: profit.grossProfit,
          netProfit: profit.netProfit,
          remark: first.remark || null,
          createdBy: input.userId ?? undefined,
          items: { create: items }
        }
      });
      existingSet.add(orderNo);
      imported++;
    }
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? undefined,
        action: "orders.imported",
        entityType: "SalesOrder",
        metadata: { fileName: input.fileName, platform, imported, skipped, sourceRows: rows.length }
      }
    });
  });

  return { imported, skipped, createdSkus, platform, sourceRows: rows.length };
}
