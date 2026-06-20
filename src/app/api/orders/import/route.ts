import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs";
import { requireApiSession, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { getImportPlatform } from "@/lib/order-import";
import { saveJobUpload } from "@/lib/import-job-files";
import { assertUploadedFile, uploadLimits } from "@/lib/upload";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const file = assertUploadedFile(form.get("file"), { label: "订单", maxBytes: uploadLimits.orderImport, extensions: [".csv", ".xlsx"] });
  const platform = getImportPlatform(form.get("platform"));
  const bytes = await file.arrayBuffer();

  const job = await enqueueJob({
    tenantId: session.tenantId,
    type: "ORDER_IMPORT",
    payload: {
      originalFileName: file.name,
      platform,
      userId: session.userId,
      queuedAt: new Date().toISOString()
    },
    createdBy: session.userId
  });
  const saved = await saveJobUpload({
    tenantId: session.tenantId,
    jobId: job.id,
    fileName: file.name,
    bytes
  });
  await db.backgroundJob.update({
    where: { id: job.id },
    data: {
      payload: {
        originalFileName: saved.originalFileName,
        storedFileName: saved.storedFileName,
        filePath: saved.filePath,
        fileBase64: Buffer.from(bytes).toString("base64"),
        platform,
        userId: session.userId,
        queuedAt: new Date().toISOString()
      }
    }
  });

  return NextResponse.redirect(new URL(`/app/jobs?queued=${job.id}`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("orders.import", handlePost);
