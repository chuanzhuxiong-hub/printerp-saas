import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const defaultRoot = process.env.JOB_UPLOAD_DIR ?? join(tmpdir(), "printerp-job-uploads");

export type SavedJobUpload = {
  filePath: string;
  originalFileName: string;
  storedFileName: string;
};

function sanitizeFileName(fileName: string) {
  const name = basename(fileName).replace(/[^\w.-]+/g, "_");
  return name || "upload.dat";
}

export async function saveJobUpload(input: {
  root?: string;
  tenantId: string;
  jobId: string;
  fileName: string;
  bytes: ArrayBuffer;
}): Promise<SavedJobUpload> {
  const root = input.root ?? defaultRoot;
  const storedFileName = sanitizeFileName(input.fileName);
  const directory = join(root, input.tenantId, input.jobId);
  await mkdir(directory, { recursive: true });
  const filePath = join(directory, storedFileName);
  await writeFile(filePath, Buffer.from(input.bytes));
  return { filePath, originalFileName: input.fileName, storedFileName };
}

export async function readJobUpload(filePath: string) {
  const bytes = await readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
