import type { ReactNode } from "react";

export function FilterBar({
  children,
  action
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-1 flex-wrap items-center gap-3 [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center [&_a]:justify-center [&_button]:min-h-10 [&_input]:min-h-10 [&_select]:min-h-10">{children}</div>
      {action && <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto [&_a]:inline-flex [&_a]:min-h-10 [&_a]:w-full [&_a]:items-center [&_a]:justify-center sm:[&_a]:w-auto">{action}</div>}
    </div>
  );
}
