import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { helpCategories } from "@/lib/help-content";
import { getOnboardingStatus } from "@/lib/onboarding";

export default async function HelpPage() {
  const session = await requireSession();
  const onboarding = await getOnboardingStatus(session.tenantId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="PrintERP 使用指南"
        title="帮助中心"
        description="面向 3D 打印电商商家的新手教程和日常操作手册。内容覆盖初始化、产品 SKU、采购、生产库存、订单发货、售后补发、利润报表和拼多多数据导入。"
      >
        <Link href="/app/help/getting-started" className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto">第一次使用 PrintERP</Link>
      </PageHeader>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <MetricCard title="教程栏目" value={`${helpCategories.length} 个`} description="覆盖从初始化到利润分析" tone="brand" />
        <MetricCard title="初始化进度" value={`${onboarding.completed} / ${onboarding.total}`} description={onboarding.isComplete ? "基础资料已完成" : "建议继续初始化"} tone={onboarding.isComplete ? "success" : "warning"} />
        <MetricCard title="适用业务" value="3D 打印电商" description="多店铺、多 SKU、多打印机管理" />
      </section>

      <OnboardingProgress data={onboarding} compact />

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {helpCategories.map((category, index) => (
          <Link key={category.href} href={category.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge tone={index === 0 ? "info" : "neutral"}>{String(index + 1).padStart(2, "0")}</StatusBadge>
              {index === 0 && <StatusBadge tone="warning">推荐先看</StatusBadge>}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink sm:text-xl">{category.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">{category.summary}</p>
            <span className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-brand">查看教程</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
