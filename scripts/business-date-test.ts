import { parseDateInput, todayInputValue } from "../src/lib/business-date";

const today = todayInputValue();
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`默认采购日期格式错误：${today}`);
if (parseDateInput("2026-05-15").toISOString() !== "2026-05-15T00:00:00.000Z") throw new Error("采购日期解析错误");

for (const value of ["2026-02-30", "2026/05/15", ""]) {
  try {
    parseDateInput(value);
    throw new Error(`非法采购日期未被拒绝：${value}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("非法采购日期未被拒绝")) throw error;
  }
}

console.log(`Business date passed: default ${today}, historical date parsing, invalid date rejection`);

