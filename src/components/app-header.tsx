"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationGroups } from "@/lib/navigation";

const pageDescriptions: Record<string, string> = Object.fromEntries(
  navigationGroups.flatMap((group) => group.items.map((item) => [item.href, item.description ?? item.label]))
);

function currentPage(pathname: string) {
  const items = navigationGroups.flatMap((group) => group.items);
  return items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function AppHeader({
  tenantName,
  userName,
  role,
  onMenuClick
}: {
  tenantName: string;
  userName: string;
  role: string;
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();
  const page = currentPage(pathname);
  const title = page?.label ?? "PrintERP";
  const description = page ? pageDescriptions[page.href] : "3D 打印电商经营后台";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm lg:hidden"
          aria-label="打开菜单"
        >
          ≡
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/app/dashboard" className="hover:text-brand">PrintERP</Link>
            <span>/</span>
            <span className="truncate">{title}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 sm:gap-3">
            <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
              {tenantName}
            </span>
          </div>
          <p className="mt-1 hidden text-xs text-slate-500 md:block">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/app/help/getting-started"
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand/30 hover:bg-blue-50 hover:text-brand md:inline-flex"
          >
            使用帮助
          </Link>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm sm:px-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden text-sm sm:block">
              <p className="font-medium leading-none text-ink">{userName}</p>
              <p className="mt-1 text-xs text-slate-500">{role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
