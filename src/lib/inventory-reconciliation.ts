import { Prisma } from "@prisma/client";

type InventoryBalance = {
  id: string;
  quantity: Prisma.Decimal.Value;
};

type LedgerQuantity = {
  itemId: string | null;
  quantity: Prisma.Decimal.Value;
};

export type InventoryMismatch = {
  itemId: string;
  balance: Prisma.Decimal;
  ledgerBalance: Prisma.Decimal;
  difference: Prisma.Decimal;
};

export function calculateInventoryMismatches(items: InventoryBalance[], transactions: LedgerQuantity[]) {
  const ledgerByItem = new Map<string, Prisma.Decimal>();
  for (const transaction of transactions) {
    if (!transaction.itemId) continue;
    ledgerByItem.set(
      transaction.itemId,
      (ledgerByItem.get(transaction.itemId) ?? new Prisma.Decimal(0)).plus(transaction.quantity)
    );
  }

  return items.flatMap<InventoryMismatch>(item => {
    const balance = new Prisma.Decimal(item.quantity);
    const ledgerBalance = ledgerByItem.get(item.id) ?? new Prisma.Decimal(0);
    const difference = balance.minus(ledgerBalance);
    return difference.eq(0) ? [] : [{ itemId: item.id, balance, ledgerBalance, difference }];
  });
}
