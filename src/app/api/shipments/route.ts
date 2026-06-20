import { InventoryCategory, InventoryTransactionType, OrderStatus, Prisma, ShipmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalText, requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { calculateOrderProfit } from "@/lib/profit";
import { decreaseInventory } from "@/lib/inventory";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const salesOrderId = text(form, "salesOrderId");
  const shippingCost = new Prisma.Decimal(decimalText(form, "shippingCost"));

  await db.$transaction(async (tx) => {
    const order = await tx.salesOrder.findFirstOrThrow({
      where: { id: salesOrderId, tenantId: session.tenantId, deletedAt: null },
      include: { items: { include: { sku: { include: { bom: { include: { items: true } } } } } } }
    });
    if (order.shipmentStatus === ShipmentStatus.SHIPPED) throw new Error("该订单已经发货");

    const productRequirements = new Map<string, { name: string; quantity: Prisma.Decimal }>();
    const packagingRequirements = new Map<string, Prisma.Decimal>();
    for (const item of order.items) {
      if (!item.skuId || !item.sku) continue;
      const existing = productRequirements.get(item.skuId);
      const quantity = new Prisma.Decimal(item.quantity);
      productRequirements.set(item.skuId, { name: item.sku.name, quantity: existing ? existing.quantity.plus(quantity) : quantity });
      for (const bomItem of item.sku.bom?.items ?? []) {
        if (bomItem.category !== InventoryCategory.PACKAGING) continue;
        const required = bomItem.quantity.mul(item.quantity);
        packagingRequirements.set(bomItem.refId, (packagingRequirements.get(bomItem.refId) ?? new Prisma.Decimal(0)).plus(required));
      }
    }

    const allRequirements = [
      ...[...productRequirements].map(([refId, value]) => ({ category: InventoryCategory.PRODUCT, refId, quantity: value.quantity })),
      ...[...packagingRequirements].map(([refId, quantity]) => ({ category: InventoryCategory.PACKAGING, refId, quantity }))
    ];
    const inventoryRows = await tx.inventoryItem.findMany({
      where: {
        tenantId: session.tenantId,
        OR: allRequirements.map(item => ({ category: item.category, refId: item.refId })),
        deletedAt: null
      }
    });
    for (const requirement of allRequirements) {
      const inventory = inventoryRows.find(item => item.category === requirement.category && item.refId === requirement.refId);
      if (!inventory || inventory.quantity.minus(inventory.lockedQuantity).lt(requirement.quantity)) {
        throw new Error(`库存不足：${inventory?.name ?? requirement.refId}`);
      }
    }

    const packagingCost = [...packagingRequirements].reduce((sum, [refId, quantity]) => {
      const inventory = inventoryRows.find(item => item.category === InventoryCategory.PACKAGING && item.refId === refId);
      return sum.plus(quantity.mul(inventory?.unitCost ?? 0));
    }, new Prisma.Decimal(0));

    const shipment = await tx.shipment.create({
      data: {
        tenantId: session.tenantId,
        salesOrderId: order.id,
        carrier: text(form, "carrier") || null,
        trackingNo: text(form, "trackingNo") || null,
        shippingCost,
        packagingCost,
        shippedAt: new Date(),
        status: ShipmentStatus.SHIPPED,
        createdBy: session.userId,
        items: {
          create: allRequirements.map(requirement => {
            const inventory = inventoryRows.find(item => item.category === requirement.category && item.refId === requirement.refId)!;
            return {
              tenantId: session.tenantId,
              category: requirement.category,
              refId: requirement.refId,
              quantity: requirement.quantity,
              unitCost: inventory.unitCost,
              totalCost: requirement.quantity.mul(inventory.unitCost)
            };
          })
        }
      }
    });

    for (const requirement of allRequirements) {
      const inventory = inventoryRows.find(item => item.category === requirement.category && item.refId === requirement.refId)!;
      await decreaseInventory(tx, {
        tenantId: session.tenantId,
        itemId: inventory.id,
        quantity: requirement.quantity,
        type: InventoryTransactionType.SALES_OUT,
        sourceType: "Shipment",
        sourceId: shipment.id,
        userId: session.userId
      });
    }

    const shipmentCosts = await tx.shipment.aggregate({
      where: { tenantId: session.tenantId, salesOrderId: order.id, deletedAt: null },
      _sum: { shippingCost: true, packagingCost: true }
    });
    const totalShippingCost = shipmentCosts._sum.shippingCost ?? new Prisma.Decimal(0);
    const totalPackagingCost = shipmentCosts._sum.packagingCost ?? new Prisma.Decimal(0);
    const profit = calculateOrderProfit({ ...order, shippingCost: totalShippingCost, packagingCost: totalPackagingCost });
    await tx.salesOrder.update({
      where: { id: order.id },
      data: { shippingCost: totalShippingCost, packagingCost: totalPackagingCost, shipmentStatus: ShipmentStatus.SHIPPED, status: OrderStatus.SHIPPED, ...profit }
    });
    await tx.shippingCost.create({
      data: { tenantId: session.tenantId, salesOrderId: order.id, shipmentId: shipment.id, carrier: shipment.carrier, amount: shippingCost, createdBy: session.userId }
    });
    await tx.costRecord.createMany({
      data: [
        { tenantId: session.tenantId, sourceType: "ShipmentShipping", sourceId: shipment.id, salesOrderId: order.id, amount: shippingCost, createdBy: session.userId },
        { tenantId: session.tenantId, sourceType: "ShipmentPackaging", sourceId: shipment.id, salesOrderId: order.id, amount: packagingCost, createdBy: session.userId }
      ]
    });
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "shipment.created",
        entityType: "Shipment",
        entityId: shipment.id,
        metadata: { orderId: order.id, shippingCost: shippingCost.toString(), packagingCost: packagingCost.toString() }
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return NextResponse.redirect(new URL("/app/shipments", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("shipments.create", handlePost);
