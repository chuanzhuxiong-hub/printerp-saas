import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { jobProcessors } from "../src/lib/job-processors";
import { readJobUpload, saveJobUpload } from "../src/lib/import-job-files";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(jobProcessors.ORDER_IMPORT, "ORDER_IMPORT processor should be registered");
  assert(jobProcessors.COST_IMPORT, "COST_IMPORT processor should be registered");
  const helperSource = readFileSync("src/lib/import-job-files.ts", "utf8");
  assert(helperSource.includes("tmpdir()"), "default import job upload directory should use the writable OS temp directory");
  assert(helperSource.includes("JOB_UPLOAD_DIR"), "import job upload directory should support JOB_UPLOAD_DIR override");

  for (const route of ["src/app/api/orders/import/route.ts", "src/app/api/cost-imports/route.ts"]) {
    const source = readFileSync(route, "utf8");
    assert(source.includes("enqueueJob"), `${route} should enqueue a background job`);
    assert(source.includes("saveJobUpload"), `${route} should persist the uploaded file for worker processing`);
  }
  const processorSource = readFileSync("src/lib/job-processors.ts", "utf8");
  assert(processorSource.includes("importOrdersFromBytes"), "ORDER_IMPORT processor should execute order import service");
  assert(processorSource.includes("importCostsFromBytes"), "COST_IMPORT processor should execute cost import service");
  assert(processorSource.includes("readJobUpload"), "import processors should read persisted upload files");
  assert(processorSource.includes("fileBase64"), "import processors should support base64 payload fallback when worker cannot access upload path");

  const root = join(process.cwd(), "tmp-import-job-test");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  try {
    const saved = await saveJobUpload({
      root,
      tenantId: "tenant-1",
      jobId: "job-1",
      fileName: "../orders.csv",
      bytes: new TextEncoder().encode("orderNo,skuCode\nA,S1").buffer
    });
    assert(saved.originalFileName === "../orders.csv", "original file name should be preserved in metadata");
    assert(saved.storedFileName === "orders.csv", "stored file name should be sanitized");
    assert(saved.filePath.includes(join("tmp-import-job-test", "tenant-1", "job-1")), "file should be stored under tenant/job directory");
    assert(existsSync(saved.filePath), "saved upload should exist on disk");
    const bytes = await readJobUpload(saved.filePath);
    assert(new TextDecoder().decode(bytes).includes("orderNo"), "read helper should return saved bytes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  console.log("Import job checks passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
