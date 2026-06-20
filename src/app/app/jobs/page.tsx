import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function badge(status: string) {
  const className = status === "SUCCEEDED" ? "text-green-700" : status === "FAILED" ? "text-red-700" : status === "RUNNING" ? "text-blue-700" : "text-muted";
  return <span className={`font-semibold ${className}`}>{status}</span>;
}

export default async function JobsPage() {
  const session = await requireSession();
  const jobs = await db.backgroundJob.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return <main>
    <PageHeader title="后台任务" description="查看导入、AI 生成、竞品同步等后台任务状态。当前已建立数据库任务队列，后续业务会逐步迁入。" />
    <form action="/api/jobs" method="post" className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-soft">
      <input type="hidden" name="action" value="enqueue-demo" />
      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">创建测试任务</button>
      <span className="text-sm text-muted">用于验证队列入队、worker 处理和状态更新。</span>
    </form>
    <DataTable headers={["创建时间", "类型", "状态", "尝试", "可执行时间", "完成时间", "错误", "操作"]} rows={jobs.map(job => [
      job.createdAt.toLocaleString("zh-CN"),
      job.type,
      badge(job.status),
      `${job.attempts}/${job.maxAttempts}`,
      job.availableAt.toLocaleString("zh-CN"),
      job.finishedAt?.toLocaleString("zh-CN") ?? "-",
      job.error ?? "-",
      <div className="flex flex-wrap gap-2">
        {["FAILED", "CANCELLED"].includes(job.status) && <form action="/api/jobs" method="post"><input type="hidden" name="action" value="retry" /><input type="hidden" name="jobId" value={job.id} /><button className="font-semibold text-brand">重试</button></form>}
        {["PENDING", "RUNNING"].includes(job.status) && <form action="/api/jobs" method="post"><input type="hidden" name="action" value="cancel" /><input type="hidden" name="jobId" value={job.id} /><button className="font-semibold text-red-600">取消</button></form>}
      </div>
    ])} emptyText="暂无后台任务" />
  </main>;
}
