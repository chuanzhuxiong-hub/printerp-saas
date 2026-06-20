import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type JobProcessor = (job: {
  id: string;
  tenantId: string;
  type: string;
  payload: Prisma.JsonValue;
}) => Promise<Prisma.InputJsonValue | void>;

export async function enqueueJob(input: {
  tenantId: string;
  type: string;
  payload: Prisma.InputJsonValue;
  priority?: number;
  createdBy?: string;
  availableAt?: Date;
}) {
  return db.backgroundJob.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      payload: input.payload,
      priority: input.priority ?? 0,
      createdBy: input.createdBy,
      availableAt: input.availableAt
    }
  });
}

export async function claimNextJob(workerId: string) {
  const now = new Date();
  const job = await db.backgroundJob.findFirst({
    where: { status: "PENDING", availableAt: { lte: now }, attempts: { lt: db.backgroundJob.fields.maxAttempts } },
    orderBy: [{ priority: "desc" }, { availableAt: "asc" }, { createdAt: "asc" }]
  });
  if (!job) return null;

  const claimed = await db.backgroundJob.updateMany({
    where: { id: job.id, status: "PENDING" },
    data: { status: "RUNNING", lockedAt: now, lockedBy: workerId, startedAt: now, attempts: { increment: 1 }, error: null }
  });
  if (claimed.count !== 1) return null;
  return db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } });
}

export async function completeJob(jobId: string, result?: Prisma.InputJsonValue) {
  return db.backgroundJob.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED", result: result ?? Prisma.JsonNull, finishedAt: new Date(), lockedAt: null, lockedBy: null }
  });
}

export async function failJob(jobId: string, error: unknown, retryDelayMs = 60_000) {
  const job = await db.backgroundJob.findUniqueOrThrow({ where: { id: jobId } });
  const message = error instanceof Error ? error.message : String(error);
  const canRetry = job.attempts < job.maxAttempts;
  return db.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: canRetry ? "PENDING" : "FAILED",
      error: message.slice(0, 2000),
      availableAt: canRetry ? new Date(Date.now() + retryDelayMs) : job.availableAt,
      finishedAt: canRetry ? null : new Date(),
      lockedAt: null,
      lockedBy: null
    }
  });
}

export async function retryJob(jobId: string, tenantId: string) {
  return db.backgroundJob.updateMany({
    where: { id: jobId, tenantId, status: { in: ["FAILED", "CANCELLED"] } },
    data: { status: "PENDING", error: null, availableAt: new Date(), finishedAt: null, lockedAt: null, lockedBy: null }
  });
}

export async function cancelJob(jobId: string, tenantId: string) {
  return db.backgroundJob.updateMany({
    where: { id: jobId, tenantId, status: { in: ["PENDING", "RUNNING"] } },
    data: { status: "CANCELLED", finishedAt: new Date(), lockedAt: null, lockedBy: null }
  });
}

export async function runOneJob(workerId: string, processors: Record<string, JobProcessor>) {
  const job = await claimNextJob(workerId);
  if (!job) return null;
  const processor = processors[job.type];
  if (!processor) {
    await failJob(job.id, new Error(`No processor registered for job type ${job.type}`), 0);
    return job;
  }
  try {
    const result = await processor(job);
    await completeJob(job.id, result === undefined ? undefined : result);
  } catch (error) {
    await failJob(job.id, error);
  }
  return job;
}
