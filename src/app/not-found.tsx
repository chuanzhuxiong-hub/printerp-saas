import Link from "next/link";

export default function NotFoundPage() {
  return <main className="mx-auto mt-20 max-w-xl rounded-xl border bg-white p-8 shadow-soft">
    <h1 className="text-2xl font-bold text-ink">没有找到这条记录</h1>
    <p className="mt-3 text-sm text-muted">记录可能已删除，或者你没有权限访问。</p>
    <Link href="/app/dashboard" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">返回经营看板</Link>
  </main>;
}
