import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8", className)}>
      {children}
    </main>
  );
}
