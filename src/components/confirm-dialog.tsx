import type { ReactNode } from "react";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  children
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
      {children}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          {cancelLabel}
        </button>
        <button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
