import ExcelJS from "exceljs";

export async function readXlsxRows<T extends Record<string, unknown>>(bytes: ArrayBuffer | Uint8Array): Promise<T[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = bytes instanceof ArrayBuffer ? Buffer.from(new Uint8Array(bytes)) : Buffer.from(bytes);
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];
  const headers: string[] = [];
  for (let column = 1; column <= sheet.columnCount; column++) headers.push(sheet.getRow(1).getCell(column).text.trim());
  const rows: T[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const record: Record<string, unknown> = {};
    let populated = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const text = row.getCell(index + 1).text.trim();
      record[header] = text;
      if (text) populated = true;
    });
    if (populated) rows.push(record as T);
  }
  return rows;
}
