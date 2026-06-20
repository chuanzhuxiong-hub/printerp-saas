import Link from "next/link";

export function MaintenanceBanner({ adminName, tenantName, reason, expiresAt }: { adminName: string; tenantName: string; reason: string; expiresAt: Date }) {
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">平台维护模式</p>
          <p className="mt-1">
            {adminName} 正在以老板权限维护 {tenantName}。原因：{reason || "未填写"}。授权到期：
            {expiresAt.toLocaleString("zh-CN")}。
          </p>
        </div>
        <Link href="/admin" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">
          返回平台后台
        </Link>
      </div>
    </div>
  );
}
