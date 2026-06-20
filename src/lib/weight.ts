import { Prisma } from "@prisma/client";

export const weightUnits = [
  { value: "KG", label: "千克（kg）" },
  { value: "G", label: "克（g）" }
] as const;

export type WeightUnit = typeof weightUnits[number]["value"];

export function convertToGrams(value: string | Prisma.Decimal, unit: string) {
  const weight = new Prisma.Decimal(value);
  if (weight.lte(0)) throw new Error("入库重量必须大于 0");
  if (unit === "KG") return weight.mul(1000);
  if (unit === "G") return weight;
  throw new Error("不支持的重量单位");
}
