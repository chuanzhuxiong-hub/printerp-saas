export default async function PlatformAdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold text-brand">PrintERP Platform</p>
        <h1 className="mt-2 text-2xl font-bold">平台管理员登录</h1>
        <p className="mt-2 text-sm text-muted">此入口仅用于平台运营与维护。</p>
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">邮箱、密码或账号状态无效。</p> : null}
        <form action="/api/admin/auth/login" method="post" className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            邮箱
            <input name="email" type="email" required className="mt-1 w-full rounded-lg border px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium">
            密码
            <input name="password" type="password" required className="mt-1 w-full rounded-lg border px-3 py-2.5" />
          </label>
          <button className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white">登录平台后台</button>
        </form>
      </div>
    </div>
  );
}
