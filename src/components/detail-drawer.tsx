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
      <aside className={cn("ml-auto flex h-dvh w-full flex-col bg-white shadow-2xl sm:max-w-xl", className)}>
        <header className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="break-words text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </aside>
    </div>
  );
}
