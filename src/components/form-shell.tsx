import Link from "next/link";
import type { ReactNode } from "react";

export function FormShell({
  title,
  description,
  action,
  backHref,
  error,
  children
}: {
  title: string;
  description: string;
  action: string;
  backHref: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="break-words text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
      </div>
      <form action={action} method="post" className="mt-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:p-6">
        {children}
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:bg-transparent sm:p-0 sm:pt-5">
          <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">保存</button>
          <Link href={backHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-muted transition hover:bg-slate-50">取消</Link>
        </div>
      </form>
    </main>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required = false,
  step,
  defaultValue,
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  step?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/15 sm:text-sm"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  required = false,
  defaultValue
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      <select name={name} required={required} defaultValue={defaultValue} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-ink shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 sm:text-sm">
        <option value="">请选择</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
