import Link from "next/link";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold text-brand">PrintERP</p>
        <h1 className="mt-2 text-2xl font-bold">登录商家空间</h1>
        <p className="mt-2 text-sm text-muted">管理订单、生产、库存与真实利润。</p>
        <form action="/api/auth/login" method="post" className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            邮箱
            <input name="email" type="email" required className="mt-1 w-full rounded-lg border px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium">
            密码
            <input name="password" type="password" required className="mt-1 w-full rounded-lg border px-3 py-2.5" />
          </label>
          <button className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white">登录</button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          还没有账号？ <Link className="font-semibold text-brand" href="/app/register">创建商家空间</Link>
        </p>
      </div>
    </div>
  );
}
