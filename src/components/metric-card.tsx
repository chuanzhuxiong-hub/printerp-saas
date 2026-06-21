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
    <section className={cn("rounded-2xl border bg-white p-4 shadow-sm sm:p-5", toneClass)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">{title}</p>
          <div className="mt-2 break-words text-xl font-semibold tracking-tight text-ink sm:text-2xl">{value}</div>
        </div>
        {icon && <div className="rounded-xl bg-white/80 p-2 text-slate-500 shadow-sm">{icon}</div>}
      </div>
      {(description || trend) && (
        <div className="mt-3 flex flex-col gap-2 text-sm sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          {description && <p className="min-w-0 break-words text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>}
          {trend && <div className="shrink-0">{trend}</div>}
        </div>
      )}
    </section>
  );
}
