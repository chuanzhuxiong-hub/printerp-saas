import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  tone = "default"
}: {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  trend?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
}) {
  const toneClass = {
    default: "border-slate-200",
    success: "border-emerald-200 bg-emerald-50/40",
    warning: "border-amber-200 bg-amber-50/50",
    danger: "border-rose-200 bg-rose-50/40",
    brand: "border-blue-200 bg-blue-50/50"
  }[tone];

  return (
    <section className={cn("rounded-2xl border bg-white p-5 shadow-sm", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</div>
        </div>
        {icon && <div className="rounded-xl bg-white/80 p-2 text-slate-500 shadow-sm">{icon}</div>}
      </div>
      {(description || trend) && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          {description && <p className="text-slate-500">{description}</p>}
          {trend}
        </div>
      )}
    </section>
  );
}
