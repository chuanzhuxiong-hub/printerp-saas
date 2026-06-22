import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { cn } from "@/lib/ui";

export function DataTable({
  headers,
  rows,
  emptyText = "暂无数据",
  emptyDescription,
  emptyActionHref,
  emptyActionLabel,
  loading = false,
  alignRightColumns = []
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyText?: string;
  emptyDescription?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  loading?: boolean;
  alignRightColumns?: number[];
}) {
  if (loading) {
    return <LoadingSkeleton rows={6} className="mt-6" />;
  }

  if (!rows.length) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:mt-6">
        <EmptyState
          title={emptyText}
          description={emptyDescription}
          actionHref={emptyActionHref}
          actionLabel={emptyActionLabel}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-6">
      <div className="space-y-3 sm:hidden">
        {rows.map((row, rowIndex) => (
          <article key={rowIndex} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">{headers[0] ?? "项目"}</p>
                <div className="mt-1 break-words text-sm font-semibold text-ink">{row[0]}</div>
              </div>
            </div>
            <dl className="mt-3 space-y-2">
              {row.slice(1).map((cell, cellOffset) => {
                const cellIndex = cellOffset + 1;
                return (
                  <div key={`${headers[cellIndex] ?? cellIndex}-${cellOffset}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-sm">
                    <dt className="text-slate-400">{headers[cellIndex] ?? `字段 ${cellIndex + 1}`}</dt>
                    <dd className={cn("min-w-0 break-words text-slate-700", alignRightColumns.includes(cellIndex) && "text-right tabular-nums")}>{cell}</dd>
                  </div>
                );
              })}
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:block">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {headers.map((header, index) => (
                  <th key={header} className={cn("px-5 py-3 font-semibold", alignRightColumns.includes(index) && "text-right")}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="transition hover:bg-slate-50/80">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={cn("px-5 py-4 align-middle text-slate-700", alignRightColumns.includes(cellIndex) && "text-right tabular-nums")}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
