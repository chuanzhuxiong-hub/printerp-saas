import { cn } from "@/lib/ui";

export function TrendIndicator({
  value,
  label
}: {
  value: number;
  label?: string;
}) {
  const positive = value >= 0;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", positive ? "text-emerald-600" : "text-rose-600")}>
      <span aria-hidden>{positive ? "↗" : "↘"}</span>
      <span>{Math.abs(value).toFixed(1)}%</span>
      {label && <span className="font-medium text-slate-500">{label}</span>}
    </span>
  );
}
