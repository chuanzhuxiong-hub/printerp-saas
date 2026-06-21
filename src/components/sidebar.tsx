"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { canAccessNavigation, navigationGroups } from "@/lib/navigation";
import { cn } from "@/lib/ui";

const itemIcons: Record<string, string> = {
  首页: "首",
  产品中心: "品",
  订单中心: "单",
  生产中心: "产",
  库存中心: "库",
  采购中心: "采",
  数据导入: "导",
  报表中心: "报",
  帮助中心: "帮",
  系统设置: "设"
};

export function Sidebar({
  tenantName,
  userName,
  role,
  maintenanceMode = false,
  mobile = false,
  className,
  onNavigate
}: {
  tenantName: string;
  userName: string;
  role: string;
  maintenanceMode?: boolean;
  mobile?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = !mobile && collapsed;

  const visibleGroups = navigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessNavigation(item, role)) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-dvh shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 shadow-sm transition-all",
        mobile ? "w-full" : "sticky top-0 h-screen",
        isCollapsed ? "w-20" : "w-72",
        className
      )}
    >
      <div className="border-b border-slate-200 px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app/dashboard" className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-sm font-bold text-white shadow-sm">PE</div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight text-ink">PrintERP</p>
                <p className="truncate text-xs text-slate-500">{tenantName}</p>
              </div>
            )}
          </Link>
          {!mobile && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {collapsed ? ">" : "<"}
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            {!isCollapsed && <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-blue-50 text-brand shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-ink")}
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-semibold", active ? "bg-brand text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white")}>{itemIcons[item.label] ?? item.label.slice(0, 1)}</span>
                    {!isCollapsed && (
                      <span className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.description && <span className="mt-0.5 block truncate text-xs font-normal text-slate-400">{item.description}</span>}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className={cn("mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3", isCollapsed && "justify-center")}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-brand shadow-sm">{userName.slice(0, 1).toUpperCase()}</div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{userName}</p>
              <p className="text-xs text-slate-500">{role}</p>
            </div>
          )}
        </div>
        {maintenanceMode ? (
          <a href="/admin" className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{isCollapsed ? "后台" : "返回平台后台"}</a>
        ) : (
          <form action="/api/auth/logout" method="post">
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50">{isCollapsed ? "退出" : "退出登录"}</button>
          </form>
        )}
      </div>
    </aside>
  );
}
