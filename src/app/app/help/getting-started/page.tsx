import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { gettingStartedSteps, helpTopicMap } from "@/lib/help-content";
import { getOnboardingStatus } from "@/lib/onboarding";

const stepLabels = ["第 1 步", "第 2 步", "第 3 步", "第 4 步", "第 5 步", "第 6 步", "第 7 步", "第 8 步", "第 9 步", "第 10 步", "第 11 步", "第 12 步", "第 13 步", "第 14 步"] as const;

export default async function GettingStartedHelpPage() {
  const session = await requireSession();
  const onboarding = await getOnboardingStatus(session.tenantId);
  const topic = helpTopicMap.get("help-getting-started")!;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="新手入门"
        title="第一次使用 PrintERP"
        description={topic.summary}
      >
        <Link href="/app/help" className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">返回帮助中心</Link>
      </PageHeader>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <MetricCard title="新手流程" value="14 步" description="从商家空间到利润报表" tone="brand" />
        <MetricCard title="初始化进度" value={`${onboarding.completed} / ${onboarding.total}`} description={onboarding.isComplete ? "基础配置已完成" : "按步骤继续补齐"} tone={onboarding.isComplete ? "success" : "warning"} />
        <MetricCard title="目标" value="算清利润" description="订单、SKU、库存和生产成本闭环" />
      </section>

      <OnboardingProgress data={onboarding} />

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {gettingStartedSteps.map((step, index) => (
          <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <StatusBadge tone="info">{stepLabels[index]}</StatusBadge>
              {index < 4 && <StatusBadge tone="warning">基础必做</StatusBadge>}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink sm:text-xl">{step.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">{step.description}</p>
            <Link href={step.href} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto">去操作</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
