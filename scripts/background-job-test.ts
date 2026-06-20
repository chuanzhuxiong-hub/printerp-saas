import { strict as assert } from "node:assert";
import { db } from "../src/lib/db";
import { enqueueJob, runOneJob } from "../src/lib/jobs";
import { jobProcessors } from "../src/lib/job-processors";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow();
  const job = await enqueueJob({
    tenantId: tenant.id,
    type: "DEMO",
    payload: { test: true },
    createdBy: "background-job-test"
  });

  try {
    await runOneJob("background-job-test-worker", jobProcessors);
    const updated = await db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(updated.status, "SUCCEEDED");
    assert.equal(updated.attempts, 1);
    assert.ok(updated.finishedAt);
    console.log("Background job queue passed: enqueue, claim, process, complete");
  } finally {
    await db.backgroundJob.deleteMany({ where: { id: job.id } });
    await db.$disconnect();
  }
}

main().catch(async error => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
