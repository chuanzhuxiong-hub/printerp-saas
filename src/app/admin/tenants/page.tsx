import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformSession } from "@/lib/platform-auth";

export default async function PlatformTenantsPage() {
  await requirePlatformSession();
  const tenants = await db.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, createdAt: true }
  });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">PrintERP Platform</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">商家维护授权</h1>
          <p className="mt-1 text-sm text-muted">填写维护原因后，可获得 30 分钟商家老板级维护权限。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/grants" className="rounded-lg border px-4 py-2 text-sm font-semibold">授权记录</Link>
          <Link href="/admin" className="rounded-lg border px-4 py-2 text-sm font-semibold">返回平台后台</Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-panel text-muted">
            <tr>
              {["商家", "Slug", "创建时间", "维护原因", "操作"].map(item => <th key={item} className="px-4 py-3">{item}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.map(tenant => (
              <tr key={tenant.id}>
                <td className="px-4 py-4 font-semibold">{tenant.name}</td>
                <td className="px-4 py-4 text-muted">{tenant.slug}</td>
                <td className="px-4 py-4">{tenant.createdAt.toLocaleString("zh-CN")}</td>
                <td className="px-4 py-4">
                  <form id={`grant-${tenant.id}`} action="/api/admin/grants" method="post">
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input name="reason" required minLength={2} placeholder="例如：排查订单导入问题" className="w-full rounded-lg border px-3 py-2" />
                  </form>
                </td>
                <td className="px-4 py-4">
                  <button form={`grant-${tenant.id}`} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">进入维护</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
