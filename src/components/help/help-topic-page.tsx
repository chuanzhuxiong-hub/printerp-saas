import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import type { HelpTopic } from "@/lib/help-content";
import { OnboardingProgress } from "@/components/onboarding-progress";
import type { OnboardingStatus } from "@/lib/onboarding";

export function HelpTopicPage({ topic, onboarding }: { topic: HelpTopic; onboarding?: OnboardingStatus }) {
  const stepCount = topic.sections.reduce((sum, section) => sum + (section.steps?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PrintERP 帮助中心"
        title={topic.title}
        description={topic.summary}
      >
        <Link href="/app/help" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">返回帮助中心</Link>
        {!topic.route.startsWith("/app/help") && <Link href={topic.route} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">打开功能</Link>}
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="适用对象" value={topic.audience} description="按角色理解操作重点" tone="brand" />
        <MetricCard title="教程结构" value={`${topic.sections.length} 个栏目`} description="适用场景、操作步骤、注意事项" />
        <MetricCard title="操作步骤" value={`${stepCount} 步`} description="按顺序完成更稳" tone="success" />
      </section>

      {onboarding && <OnboardingProgress data={onboarding} />}

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="space-y-8">
          {topic.sections.map((section) => (
            <section key={section.title}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
                <StatusBadge tone="neutral">教程</StatusBadge>
              </div>
              {section.scenario && <p className="text-sm leading-7 text-slate-600">{section.scenario}</p>}
              {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-700">{paragraph}</p>)}
              {section.steps && (
                <DataTable
                  headers={["步骤", "说明"]}
                  rows={section.steps.map((step, index) => [`第 ${index + 1} 步`, step])}
                  alignRightColumns={[0]}
                />
              )}
              {section.tips && section.tips.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">注意事项</p>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-emerald-900">{section.tips.map((tip) => <li key={tip}>• {tip}</li>)}</ul>
                </div>
              )}
              {section.commonMistakes && section.commonMistakes.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">常见错误</p>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900">{section.commonMistakes.map((item) => <li key={item}>• {item}</li>)}</ul>
                </div>
              )}
              {section.next && section.next.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-ink">下一步建议</p>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">{section.next.map((item) => <li key={item}>• {item}</li>)}</ul>
                </div>
              )}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
