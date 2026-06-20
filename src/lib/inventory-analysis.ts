import { Prisma } from "@prisma/client";

export function calculateReplenishment(input: {
  quantity: Prisma.Decimal.Value;
  lockedQuantity: Prisma.Decimal.Value;
  warningStock: Prisma.Decimal.Value;
  consumedLast30Days: Prisma.Decimal.Value;
}) {
  const available = new Prisma.Decimal(input.quantity).minus(input.lockedQuantity);
  const warning = new Prisma.Decimal(input.warningStock);
  const consumed = new Prisma.Decimal(input.consumedLast30Days).abs();
  const averageDaily = consumed.div(30);
  const coverageDays = averageDaily.gt(0) ? available.div(averageDaily) : null;
  const target = Prisma.Decimal.max(warning.mul(2), averageDaily.mul(30));
  const recommendedQuantity = Prisma.Decimal.max(new Prisma.Decimal(0), target.minus(available));
  const urgent = available.lte(warning) || Boolean(coverageDays?.lte(7));
  return { available, averageDaily, coverageDays, recommendedQuantity, urgent };
}

export function isSlowInventory(input: { quantity: Prisma.Decimal.Value; soldLast60Days: number; lastSoldAt: Date | null; now?: Date }) {
  const quantity = new Prisma.Decimal(input.quantity);
  const now = input.now ?? new Date();
  const daysSinceSale = input.lastSoldAt ? Math.floor((now.getTime() - input.lastSoldAt.getTime()) / 86400000) : null;
  return {
    slow: quantity.gt(0) && input.soldLast60Days === 0,
    daysSinceSale,
    stockQuantity: quantity
  };
}
