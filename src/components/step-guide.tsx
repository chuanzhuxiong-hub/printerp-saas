import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function StepGuide({
  steps
}: {
  steps: Array<{
    title: string;
    description: string;
    completed?: boolean;
    action?: ReactNode;
  }>;
}) {
  return (
    <div className="grid gap-4">
      {steps.map((step, index) => (
        <section key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
              step.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}
          >
            {step.completed ? "✓" : index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
            {step.action && <div className="mt-3">{step.action}</div>}
          </div>
        </section>
      ))}
    </div>
  );
}
