import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-5 sm:py-6 lg:px-8", className)}>
      {children}
    </main>
  );
}
