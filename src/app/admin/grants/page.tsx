import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformSession } from "@/lib/platform-auth";

export default async function PlatformGrantsPage() {
  const session = await requirePlatformSession();
  const grants = await db.tenantAccessGrant.findMany({
    where: { platformAdminId: session.platformAdminId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { tenant: { select: { name: true } } }
  });
  const now = new Date();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">PrintERP Platform</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">维护授权记录</h1>
          <p className="mt-1 text-sm text-muted">查看当前账号的维护授权，可撤销仍在有效期内的授权。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/tenants" className="rounded-lg border px-4 py-2 text-sm font-semibold">创建授权</Link>
          <Link href="/admin" className="rounded-lg border px-4 py-2 text-sm font-semibold">返回平台后台</Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-panel text-muted">
            <tr>
              {["商家", "原因", "状态", "创建时间", "到期时间", "操作"].map(item => <th key={item} className="px-4 py-3">{item}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {grants.map(grant => {
              const active = !grant.revokedAt && grant.expiresAt > now;
              return (
                <tr key={grant.id}>
                  <td className="px-4 py-4 font-semibold">{grant.tenant.name}</td>
                  <td className="px-4 py-4">{grant.reason}</td>
                  <td className="px-4 py-4">{grant.revokedAt ? "已撤销" : grant.expiresAt <= now ? "已过期" : "有效"}</td>
                  <td className="px-4 py-4">{grant.createdAt.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-4">{grant.expiresAt.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-4">
                    {active ? (
                      <form action={`/api/admin/grants/${grant.id}/revoke`} method="post">
                        <button className="rounded-lg border px-3 py-1.5">撤销</button>
                      </form>
                    ) : "无"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
