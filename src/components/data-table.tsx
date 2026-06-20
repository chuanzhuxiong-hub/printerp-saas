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

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {headers.map((header, index) => (
                <th key={header} className={cn("px-5 py-3 font-semibold", alignRightColumns.includes(index) && "text-right")}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition hover:bg-slate-50/80">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={cn("px-5 py-4 align-middle text-slate-700", alignRightColumns.includes(cellIndex) && "text-right tabular-nums")}>
                    {cell}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={headers.length} className="px-5 py-8">
                  <EmptyState
                    title={emptyText}
                    description={emptyDescription}
                    actionHref={emptyActionHref}
                    actionLabel={emptyActionLabel}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
