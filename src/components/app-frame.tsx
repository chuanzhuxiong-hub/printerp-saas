"use client";

import type { ReactNode } from "react";
import { cloneElement, isValidElement, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/ui";

export function AppFrame({
  tenantName,
  userName,
  role,
  maintenanceMode,
  header,
  children
}: {
  tenantName: string;
  userName: string;
  role: string;
  maintenanceMode: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerWithMenu = isValidElement<{ onMenuClick?: () => void }>(header)
    ? cloneElement(header, { onMenuClick: () => setMobileOpen(true) })
    : header;

  return (
    <div className="min-h-screen bg-slate-100/80 lg:flex">
      <Sidebar
        tenantName={tenantName}
        userName={userName}
        role={role}
        maintenanceMode={maintenanceMode}
        className="hidden lg:flex"
      />

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-950/40 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="关闭菜单"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[86vw] max-w-80 transform transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar
            tenantName={tenantName}
            userName={userName}
            role={role}
            maintenanceMode={maintenanceMode}
            mobile
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {headerWithMenu}
        <PageShell>{children}</PageShell>
      </div>
    </div>
  );
}
