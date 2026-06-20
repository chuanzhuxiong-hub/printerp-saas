import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function DetailDrawer({
  title,
  description,
  children,
  open = false,
  className
}: {
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30">
      <aside className={cn("ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl", className)}>
        <header className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}
