import type { JobProcessor } from "@/lib/jobs";
import { importCostsFromBytes } from "@/lib/cost-import-service";
import { readJobUpload } from "@/lib/import-job-files";
import { importOrdersFromBytes } from "@/lib/order-import-service";

function payloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) throw new Error(`Job payload missing ${key}`);
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== "string" || !value) throw new Error(`Job payload ${key} must be a string`);
  return value;
}

async function readUploadBytes(payload: unknown) {
  const filePath = payloadString(payload, "filePath");
  try {
    return await readJobUpload(filePath);
  } catch (error) {
    if (payload && typeof payload === "object") {
      const fileBase64 = (payload as Record<string, unknown>).fileBase64;
      if (typeof fileBase64 === "string" && fileBase64) {
        const buffer = Buffer.from(fileBase64, "base64");
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      }
    }
    throw error;
  }
}

export const jobProcessors: Record<string, JobProcessor> = {
  async DEMO(job) {
    return {
      ok: true,
      jobId: job.id,
      processedAt: new Date().toISOString()
    };
  },
  async ORDER_IMPORT(job) {
    const fileName = payloadString(job.payload, "originalFileName");
    const platform = payloadString(job.payload, "platform");
    const bytes = await readUploadBytes(job.payload);
    return importOrdersFromBytes({
      tenantId: job.tenantId,
      userId: (job.payload as Record<string, unknown>).userId as string | undefined,
      fileName,
      platform,
      bytes
    });
  },
  async COST_IMPORT(job) {
    const fileName = payloadString(job.payload, "originalFileName");
    const type = payloadString(job.payload, "type");
    const bytes = await readUploadBytes(job.payload);
    return importCostsFromBytes({
      tenantId: job.tenantId,
      userId: (job.payload as Record<string, unknown>).userId as string | undefined,
      fileName,
      type,
      bytes
    });
  }
};
