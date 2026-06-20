import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { db } from "../src/lib/db";
import { runOneJob } from "../src/lib/jobs";
import { jobProcessors } from "../src/lib/job-processors";

const workerId = `worker-${randomUUID()}`;
const limit = Number.parseInt(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "10", 10);
const loop = process.argv.includes("--loop");
const interval = Number.parseInt(process.argv.find((arg) => arg.startsWith("--interval="))?.split("=")[1] ?? "5000", 10);

async function runBatch() {
  let processed = 0;
  for (let index = 0; index < limit; index++) {
    const job = await runOneJob(workerId, jobProcessors);
    if (!job) break;
    processed++;
  }
  console.log(`Job worker processed ${processed} job(s)`);
  return processed;
}

async function main() {
  if (!loop) {
    await runBatch();
    return;
  }

  console.log(`Job worker started in loop mode: limit=${limit}, interval=${interval}ms`);
  while (true) {
    await runBatch();
    await sleep(interval);
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
