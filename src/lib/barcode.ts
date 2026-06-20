import { InventoryCategory } from "@prisma/client";

export function inventoryBarcode(category: InventoryCategory, refId: string) {
  return `${category}:${refId}`;
}

export function parseInventoryBarcode(value: string) {
  const [category, ...parts] = value.trim().split(":");
  if (!Object.values(InventoryCategory).includes(category as InventoryCategory) || !parts.length) return null;
  return { category: category as InventoryCategory, refId: parts.join(":") };
}
