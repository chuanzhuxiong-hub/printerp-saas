import { readFileSync } from "node:fs";
import { assertUploadedFile, uploadLimits } from "../src/lib/upload";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function assertThrows(action: () => unknown, expected: string) {
  try {
    action();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `Expected error containing "${expected}"`);
    return;
  }
  throw new Error(`Expected action to throw "${expected}"`);
}

const validFile = new File(["sku,qty\nA,1"], "orders.csv", { type: "text/csv" });
assert(assertUploadedFile(validFile, { label: "订单", maxBytes: uploadLimits.orderImport, extensions: [".csv"] }) === validFile, "valid upload should pass");

const oversizedFile = new File([new Uint8Array(uploadLimits.productGrowthCsv + 1)], "competitors.csv", { type: "text/csv" });
assertThrows(() => assertUploadedFile(oversizedFile, { label: "竞品 CSV", maxBytes: uploadLimits.productGrowthCsv, extensions: [".csv"] }), "不能超过");

const wrongExtension = new File(["x"], "orders.txt", { type: "text/plain" });
assertThrows(() => assertUploadedFile(wrongExtension, { label: "订单", maxBytes: uploadLimits.orderImport, extensions: [".csv"] }), "仅支持");
assertThrows(() => assertUploadedFile(null, { label: "订单", maxBytes: uploadLimits.orderImport, extensions: [".csv"] }), "请选择");

const guardedRoutes = [
  "src/app/api/orders/import/route.ts",
  "src/app/api/cost-imports/route.ts",
  "src/app/api/gcode/route.ts",
  "src/app/api/products/growth/route.ts"
];

for (const route of guardedRoutes) {
  const source = readFileSync(route, "utf8");
  assert(source.includes("@/lib/upload"), `${route} must import the upload guard`);
  assert(source.includes("assertUploadedFile") || source.includes("uploadedCsv"), `${route} must validate uploaded files through the shared guard`);
}

console.log("Upload limit checks passed");
