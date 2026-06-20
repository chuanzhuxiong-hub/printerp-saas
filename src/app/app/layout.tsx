import { AppHeader } from "@/components/app-header";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { PageShell } from "@/components/page-shell";
import { Sidebar } from "@/components/sidebar";
import { getAppSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessPath, homePathForRole, pageRoleRules } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { session, hasValidPlatformSession } = await getAppSession();
  const pathname = (await headers()).get("x-next-pathname") ?? "";

  if (!session) {
    if (hasValidPlatformSession) redirect("/admin");
    if (pathname && pathname !== "/app/login" && pathname !== "/app/register") redirect("/app/login");
    return <>{children}</>;
  }

  if (pathname && !canAccessPath(pathname, session.role, pageRoleRules)) redirect(homePathForRole(session.role));

  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  const isMaintenance = session.actorType === "PLATFORM_ADMIN";
  const tenantName = tenant?.name ?? session.tenantName ?? "商家空间";

  return (
    <div className="flex min-h-screen bg-slate-100/80">
      <Sidebar tenantName={tenantName} userName={session.name} role={session.role} maintenanceMode={isMaintenance} />
      <div className="min-w-0 flex-1">
        <AppHeader tenantName={tenantName} userName={session.name} role={session.role} />
        <PageShell>
          {isMaintenance && (
            <MaintenanceBanner
              adminName={session.name}
              tenantName={tenantName}
              reason={session.maintenanceReason ?? ""}
              expiresAt={session.maintenanceExpiresAt!}
            />
          )}
          {children}
        </PageShell>
      </div>
    </div>
  );
}
