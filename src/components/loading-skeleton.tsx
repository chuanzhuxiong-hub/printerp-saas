import { cn } from "@/lib/ui";

export function LoadingSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-4 animate-pulse rounded-full bg-slate-100" style={{ width: `${96 - index * 8}%` }} />
      ))}
    </div>
  );
}
