import { strict as assert } from "node:assert";
import ExcelJS from "exceljs";
import { readXlsxRows } from "../src/lib/spreadsheet";

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");
  sheet.addRow(["订单号", "SKU编码", "数量"]);
  sheet.addRow(["SO-XLSX-1", "SKU-1", 2]);
  sheet.addRow(["SO-XLSX-2", "SKU-2", 1]);
  const bytes = await workbook.xlsx.writeBuffer();
  const rows = await readXlsxRows<Record<string, unknown>>(bytes as unknown as Uint8Array);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]["订单号"], "SO-XLSX-1");
  assert.equal(rows[0]["SKU编码"], "SKU-1");
  assert.equal(rows[0]["数量"], "2");
  console.log("XLSX reader passed: 4 checks");
}

main();
