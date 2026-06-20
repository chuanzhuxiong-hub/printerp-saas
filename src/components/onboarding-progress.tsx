import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { onboardingItems, OnboardingStatus } from "@/lib/onboarding";

export function OnboardingProgress({ data, compact = false }: { data: OnboardingStatus; compact?: boolean }) {
  const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-brand">初始化向导</p>
            <StatusBadge tone={data.isComplete ? "success" : "warning"}>{data.isComplete ? "已完成" : "未完成"}</StatusBadge>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">初始化进度：{data.completed} / {data.total} 已完成</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">完成基础资料配置后，系统才能准确计算订单利润、库存和生产成本。</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {!data.isComplete && <Link href="/app/help/getting-started" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">继续初始化</Link>}
      </div>
      <div className={`mt-5 grid gap-3 ${compact ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-2"}`}>
        {onboardingItems.map((item) => {
          const done = data.status[item.key];
          return (
            <div key={item.key} className={`rounded-xl border p-4 ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{done ? "✓" : "·"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{item.label}</p>
                  {!compact && <p className="mt-1 text-sm leading-6 text-slate-500">{item.hint}</p>}
                  {!done && <Link href={item.href} className="mt-3 inline-block text-sm font-semibold text-brand">去完成</Link>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
