import { requirePlatformSession } from "@/lib/platform-auth";

export default async function PlatformAdminPage() {
  const session = await requirePlatformSession();
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="rounded-2xl bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold text-brand">PrintERP Platform</p>
        <h1 className="mt-2 text-2xl font-bold">平台管理后台</h1>
        <p className="mt-2 text-sm text-muted">{session.name}，独立平台管理员鉴权已启用。</p>
        <form action="/api/admin/auth/logout" method="post" className="mt-6">
          <button className="rounded-lg border px-4 py-2 text-sm font-semibold">退出登录</button>
        </form>
      </div>
    </main>
  );
}
