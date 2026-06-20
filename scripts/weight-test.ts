import { convertToGrams } from "../src/lib/weight";

const checks = [
  [convertToGrams("1", "KG").toString(), "1000"],
  [convertToGrams("1.25", "KG").toString(), "1250"],
  [convertToGrams("750", "G").toString(), "750"]
];

for (const [actual, expected] of checks) {
  if (actual !== expected) throw new Error(`重量换算错误：预期 ${expected}g，实际 ${actual}g`);
}

for (const [value, unit] of [["0", "KG"], ["-1", "G"], ["1", "LB"]]) {
  try {
    convertToGrams(value, unit);
    throw new Error(`无效重量未被拒绝：${value} ${unit}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("无效重量未被拒绝")) throw error;
  }
}

console.log("Weight conversion passed: kg default conversion, g passthrough, invalid input rejection");

