import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel = "新增",
  eyebrow,
  children
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>}
          <h1 className="break-words text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {children}
          {actionHref && (
            <Link
              href={actionHref}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
