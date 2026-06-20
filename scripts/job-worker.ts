import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { runOneJob } from "../src/lib/jobs";
import { jobProcessors } from "../src/lib/job-processors";

const workerId = `local-worker-${randomUUID()}`;
const limit = Number.parseInt(process.argv.find(arg => arg.startsWith("--limit="))?.split("=")[1] ?? "10", 10);

async function main() {
  let processed = 0;
  for (let index = 0; index < limit; index++) {
    const job = await runOneJob(workerId, jobProcessors);
    if (!job) break;
    processed++;
  }
  console.log(`Job worker processed ${processed} job(s)`);
  await db.$disconnect();
}

main().catch(async error => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
