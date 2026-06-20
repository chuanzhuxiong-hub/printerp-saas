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
    <main className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <form action={action} method="post" className="mt-6 space-y-5 rounded-xl border bg-white p-6 shadow-soft">
        {children}
        <div className="flex gap-3 border-t pt-5">
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">保存</button>
          <Link href={backHref} className="rounded-lg border px-4 py-2 text-sm font-semibold text-muted">取消</Link>
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
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border px-3 py-2.5"
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
    <label className="block text-sm font-medium">
      {label}
      <select name={name} required={required} defaultValue={defaultValue} className="mt-1 w-full rounded-lg border px-3 py-2.5">
        <option value="">请选择</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
