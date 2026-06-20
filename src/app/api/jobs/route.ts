import { NextResponse } from "next/server";
import { enqueueJob, cancelJob, retryJob } from "@/lib/jobs";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const action = text(form, "action");

  if (action === "enqueue-demo") {
    await enqueueJob({
      tenantId: session.tenantId,
      type: "DEMO",
      payload: { source: "manual-test", queuedAt: new Date().toISOString() },
      createdBy: session.userId
    });
  } else if (action === "retry") {
    await retryJob(text(form, "jobId"), session.tenantId);
  } else if (action === "cancel") {
    await cancelJob(text(form, "jobId"), session.tenantId);
  } else {
    return NextResponse.json({ error: "Unsupported job action" }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/app/jobs", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("jobs.post", handlePost);
