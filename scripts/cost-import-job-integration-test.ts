import { PrismaClient } from "@prisma/client";
import { jobProcessors } from "../src/lib/job-processors";
import { completeJob } from "../src/lib/jobs";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const startedAt = new Date();
const orderNo = `COST-IMPORT-JOB-${Date.now()}`;

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`登录失败 (${response.status})`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function upload(cookie: string) {
  const form = new FormData();
  form.set("type", "SHIPPING");
  form.set("file", new File([
    `订单号,快递费,运单号\n${orderNo},5.25,YT001\n${orderNo},7.25,YT002\n`
  ], "shipping-test.csv", { type: "text/csv" }));
  const response = await fetch(`${baseUrl}/api/cost-imports`, { method: "POST", headers: { cookie }, body: form, redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  if (response.status !== 303 || !location.includes("/app/jobs")) {
    throw new Error(`费用导入任务入队失败 (${response.status}, location=${location}): ${await response.text()}`);
  }
  return new URL(location).searchParams.get("queued") ?? "";
}

async function runUntilJobDone(jobId: string) {
  const job = await db.backgroundJob.findUniqueOrThrow({ where: { id: jobId } });
  const processor = jobProcessors[job.type];
  if (!processor) throw new Error(`缺少任务处理器：${job.type}`);
  const result = await processor(job);
  await completeJob(job.id, result === undefined ? undefined : result);
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow();
  const user = await db.user.findFirstOrThrow({ where: { email: "owner@demo.printerp.local" } });
  const order = await db.salesOrder.create({
    data: { tenantId: tenant.id, orderNo, receivedAmount: "100", grossProfit: "100", netProfit: "100", createdBy: user.id }
  });

  try {
    const cookie = await login();
    await runUntilJobDone(await upload(cookie));
    await runUntilJobDone(await upload(cookie));

    const updated = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id } });
    if (!updated.shippingCost.equals("12.50")) throw new Error(`快递费应为 12.50，实际为 ${updated.shippingCost}`);
    if (!updated.netProfit.equals("87.50")) throw new Error(`净利应为 87.50，实际为 ${updated.netProfit}`);
    const records = await db.costRecord.count({ where: { tenantId: tenant.id, sourceType: "ShippingBillImport", sourceId: order.id } });
    if (records !== 1) throw new Error(`重复导入后成本记录应为 1 条，实际为 ${records}`);
    console.log("Cost import job integration passed: queued import, worker processing, idempotency");
  } finally {
    await db.backgroundJob.deleteMany({ where: { tenantId: tenant.id, type: "COST_IMPORT", createdAt: { gte: startedAt } } });
    await db.costRecord.deleteMany({ where: { salesOrderId: order.id } });
    await db.auditLog.deleteMany({ where: { tenantId: tenant.id, action: "shipping-bill.imported", createdAt: { gte: startedAt } } });
    await db.salesOrder.delete({ where: { id: order.id } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main().catch(async error => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
