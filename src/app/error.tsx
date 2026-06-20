"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto mt-20 max-w-xl rounded-xl border bg-white p-8 shadow-soft">
    <h1 className="text-2xl font-bold text-ink">操作未完成</h1>
    <p className="mt-3 text-sm text-muted">{error.message || "发生了未预期的错误，请检查输入后重试。"}</p>
    <button onClick={reset} className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">重新加载</button>
  </main>;
}
