type Stat = { label: string; value: string; note?: string };

export function ModulePage({
  title,
  description,
  action = "新增",
  stats = [],
  columns = []
}: {
  title: string;
  description: string;
  action?: string;
  stats?: Stat[];
  columns?: string[];
}) {
  return (
    <main>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          {action}
        </button>
      </div>
      {stats.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border bg-white p-5 shadow-soft">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-ink">{stat.value}</p>
              {stat.note && <p className="mt-1 text-xs text-muted">{stat.note}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-soft">
        <div className="border-b px-5 py-4">
          <input className="w-72 rounded-lg border px-3 py-2 text-sm" placeholder="搜索..." />
        </div>
        <div className="grid min-h-56 place-items-center">
          <div className="text-center">
            <p className="font-medium text-ink">模块数据表已就绪</p>
            <p className="mt-1 text-sm text-muted">{columns.join(" · ")}</p>
            <p className="mt-3 text-xs text-slate-400">接下来可在此基础上接入表单与 CRUD API。</p>
          </div>
        </div>
      </div>
    </main>
  );
}
