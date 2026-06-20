import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function GcodePage({
  searchParams
}: {
  searchParams: Promise<{ targetType?: string; grams?: string; hours?: string; slicer?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const [boms, production] = await Promise.all([
    db.productBom.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, include: { sku: true }, orderBy: { updatedAt: "desc" } }),
    db.productionOrder.findMany({
      where: { tenantId: session.tenantId, deletedAt: null, status: { in: ["PENDING", "PRINTING", "QC_PENDING", "REWORK"] } },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return <main>
    <PageHeader title="G-code 解析" description="提取切片器统计的耗材克数与打印时间，并更新 BOM 或未完成生产任务。" />
    {query.targetType && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      解析完成：切片器 {query.slicer}，耗材 {query.grams} 克，打印 {query.hours} 小时，已更新 {query.targetType === "BOM" ? "BOM" : "生产任务"}。
    </p>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <UploadCard
        targetType="BOM"
        title="更新产品 BOM"
        description="更新理论耗材克数和预计打印小时，并按当前耗材单价调整理论产品成本。"
        options={boms.map(item => ({ value: item.id, label: `${item.sku.skuCode} · ${item.sku.name}` }))}
      />
      <UploadCard
        targetType="PRODUCTION"
        title="预填生产任务"
        description="将解析值写入未完成任务的实际耗材和实际打印小时，生产完成时仍可确认修改。"
        options={production.map(item => ({ value: item.id, label: `${item.orderNo} · ${item.status}` }))}
      />
    </div>
    <div className="mt-6 rounded-lg bg-panel p-4 text-sm text-muted">
      支持 Cura、PrusaSlicer、OrcaSlicer、Bambu Studio 常见统计注释。文件最大 20 MB；解析不会执行 G-code 指令。
    </div>
  </main>;
}

function UploadCard({
  targetType,
  title,
  description,
  options
}: {
  targetType: string;
  title: string;
  description: string;
  options: Array<{ value: string; label: string }>;
}) {
  return <form action="/api/gcode" method="post" encType="multipart/form-data" className="space-y-4 rounded-xl border bg-white p-6 shadow-soft">
    <input type="hidden" name="targetType" value={targetType} />
    <div><h2 className="font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div>
    <select name="targetId" required className="block w-full rounded-lg border px-3 py-2.5 text-sm">
      <option value="">请选择更新目标</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <input name="file" type="file" accept=".gcode,.gco,.gc" required className="block w-full rounded-lg border px-3 py-2.5 text-sm" />
    <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">解析并更新</button>
  </form>;
}
