import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { FormSection } from "@/components/form-section";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type TabKey = "overview" | "models" | "content" | "competitors";

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  { key: "overview", label: "SKU / BOM", description: "销售规格、打印配方、成本和库存警戒线" },
  { key: "models", label: "模型文件", description: "默认模型、版本和打印参数" },
  { key: "content", label: "AI 内容", description: "AI 标题、AI 主图、AI 详情页" },
  { key: "competitors", label: "竞品监控", description: "最多 5 个竞品，价格和销量快照" }
];

function Input({
  name,
  label,
  type = "text",
  required = false,
  defaultValue = ""
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | Prisma.Decimal | null;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue == null ? "" : String(defaultValue)}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      />
    </label>
  );
}

function money(value: Prisma.Decimal | number | string) {
  return `¥${new Prisma.Decimal(value).toFixed(2)}`;
}

function activeTab(value?: string): TabKey {
  return tabs.some((tab) => tab.key === value) ? value as TabKey : "overview";
}

function ContentActions({ productId, contentId, contentType, isCurrent }: { productId: string; contentId: string; contentType: string; isCurrent: boolean }) {
  const hidden = (
    <>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="contentType" value={contentType} />
    </>
  );

  return (
    <div className="flex min-w-[180px] flex-wrap justify-end gap-2">
      {!isCurrent && (
        <form action="/api/products/growth" method="post">
          {hidden}
          <input type="hidden" name="action" value="adopt-content" />
          <button className="font-semibold text-brand">审核并采用</button>
        </form>
      )}
      <form action="/api/products/growth" method="post">
        {hidden}
        <input type="hidden" name="action" value="review-content" />
        <input type="hidden" name="reviewStatus" value="REJECTED" />
        <button className="font-semibold text-rose-600">驳回</button>
      </form>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; message?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const query = await searchParams;
  const tab = activeTab(query.tab);

  const product = await db.product.findFirst({
    where: { id, tenantId: session.tenantId, deletedAt: null },
    include: {
      skus: { where: { deletedAt: null }, include: { bom: true }, orderBy: { createdAt: "desc" } },
      models: { orderBy: [{ status: "asc" }, { version: "desc" }] },
      titleVersions: { orderBy: { createdAt: "desc" } },
      detailVersions: { orderBy: { createdAt: "desc" } },
      contentAssets: { orderBy: { createdAt: "desc" } },
      competitors: { include: { snapshots: { orderBy: { collectedAt: "desc" }, take: 10 } }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] },
      competitorAlerts: { orderBy: { createdAt: "desc" }, take: 50 }
    }
  });

  if (!product) notFound();

  const skuIds = product.skus.map((sku) => sku.id);
  const inventoryItems = skuIds.length
    ? await db.inventoryItem.findMany({
        where: { tenantId: session.tenantId, category: "PRODUCT", refId: { in: skuIds }, deletedAt: null }
      })
    : [];
  const inventoryByRefId = new Map(inventoryItems.map((item) => [item.refId, item]));

  const activeCompetitors = product.competitors.filter((item) => item.status === "ACTIVE");
  const configuredBomCount = product.skus.filter((sku) => sku.bom).length;
  const boundSkuModelCount = product.skus.filter((sku) => product.models.some((model) => model.skuId === sku.id || (!model.skuId && model.isCurrent))).length;
  const contentCount = product.titleVersions.length + product.contentAssets.length + product.detailVersions.length;
  const riskCount = product.skus.filter((sku) => {
    const inventory = inventoryByRefId.get(sku.id);
    const lowStock = inventory ? inventory.quantity.lte(sku.warningStock) : false;
    const lowProfit = sku.bom ? sku.salePrice.minus(sku.bom.estimatedProductCost).lte(0) : false;
    return !sku.bom || lowStock || lowProfit;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="产品工作台"
        title={product.name}
        description={`${product.category ?? "未分类"} · 在产品详情集中维护 SKU / BOM、模型文件、AI 内容和竞品监控，不把 SKU、BOM、模型、AI、竞品拆成独立一级菜单。`}
        actionHref={`/app/products/${product.id}/edit`}
        actionLabel="编辑产品"
      >
        <Link href="/app/products" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">返回产品中心</Link>
      </PageHeader>

      {query.saved && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.message ?? "已保存并记录审计日志。"}</p>}
      {query.error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="SKU 数量" value={product.skus.length} description={`${configuredBomCount} 个已配置 BOM / 打印配方`} tone={product.skus.length ? "brand" : "warning"} />
        <MetricCard title="模型文件" value={product.models.length} description={`${boundSkuModelCount} 个 SKU 已绑定模型`} tone={boundSkuModelCount === product.skus.length && product.skus.length ? "success" : "warning"} />
        <MetricCard title="AI 内容" value={contentCount} description="AI 标题、AI 主图、AI 详情页候选内容" tone={contentCount ? "success" : "warning"} />
        <MetricCard title="竞品监控" value={`${activeCompetitors.length}/5`} description="最多 5 个竞品链接" tone={activeCompetitors.length >= 5 ? "warning" : "brand"} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="font-semibold text-ink">风险提示</h2>
          <p className="mt-1 text-sm text-slate-600">该产品有 {riskCount} 个 SKU 存在未配置 BOM、低利润或低库存风险。请优先处理毛利预警和库存不足，避免订单越卖越亏或无法发货。</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusBadge tone={riskCount ? "warning" : "success"}>{riskCount ? "需要处理" : "风险正常"}</StatusBadge>
          <Link href={`/app/products/${id}?tab=overview`} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand shadow-sm hover:bg-blue-50">操作面板</Link>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={`/app/products/${id}?tab=${item.key}`}
            className={`rounded-2xl border p-4 shadow-sm transition ${tab === item.key ? "border-blue-200 bg-blue-50 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}
          >
            <p className="font-semibold">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <section className="space-y-6">
          <FormSection title="新增 SKU" description="SKU 是真实销售、库存、生产和利润核算对象。每个 SKU 建议配置售价、颜色、规格、BOM / 打印配方、库存警戒线和默认模型。">
            <form action="/api/skus" method="post" className="grid gap-4 md:grid-cols-5">
              <input type="hidden" name="productId" value={id} />
              <input type="hidden" name="returnTo" value={`/app/products/${id}`} />
              <Input name="skuCode" label="SKU 编码" required />
              <Input name="name" label="SKU 名称" required />
              <Input name="salePrice" label="售价" type="number" required />
              <Input name="warningStock" label="库存警戒线" type="number" />
              <button className="self-end rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">在产品内新增 SKU</button>
            </form>
          </FormSection>

          <DataTable
            headers={["SKU", "售价", "颜色/规格", "理论克重", "打印时间", "预估成本", "库存警戒线", "配置状态", "操作"]}
            rows={product.skus.map((sku) => {
              const modelCount = product.models.filter((model) => model.skuId === sku.id || (!model.skuId && model.isCurrent)).length;
              const inventory = inventoryByRefId.get(sku.id);
              const lowStock = inventory ? inventory.quantity.lte(sku.warningStock) : false;
              const lowProfit = sku.bom ? sku.salePrice.minus(sku.bom.estimatedProductCost).lte(0) : false;
              return [
                <div key={`${sku.id}-name`}><p className="font-semibold text-ink">{sku.name}</p><p className="text-xs text-slate-500">{sku.skuCode}</p></div>,
                money(sku.salePrice),
                [sku.color, sku.size].filter(Boolean).join(" / ") || "未设置",
                `${sku.bom?.theoreticalGrams.toFixed(3) ?? "-"}g`,
                `${sku.bom?.estimatedPrintHours.toFixed(2) ?? "-"}h`,
                sku.bom ? money(sku.bom.estimatedProductCost) : "-",
                sku.warningStock.toFixed(3),
                <div key={`${sku.id}-status`} className="flex flex-wrap gap-2">
                  <StatusBadge tone={sku.bom ? "success" : "warning"}>{sku.bom ? "已配置 BOM" : "未配置 BOM"}</StatusBadge>
                  <StatusBadge tone={modelCount ? "success" : "warning"}>{modelCount ? "已绑定模型" : "未绑定模型"}</StatusBadge>
                  {lowProfit && <StatusBadge tone="danger">低利润</StatusBadge>}
                  {lowStock && <StatusBadge tone="danger">低库存</StatusBadge>}
                </div>,
                <div key={`${sku.id}-actions`} className="flex justify-end gap-3">
                  <Link className="font-semibold text-brand" href={`/app/skus/${sku.id}/edit`}>编辑 SKU</Link>
                  <Link className="font-semibold text-brand" href={sku.bom ? `/app/boms/${sku.bom.id}/edit` : `/app/boms/new?skuId=${sku.id}&returnTo=/app/products/${id}`}>{sku.bom ? "编辑 BOM" : "设置 BOM"}</Link>
                </div>
              ];
            })}
            emptyText="暂无 SKU"
            emptyDescription="先添加 SKU，再配置 BOM / 打印配方、默认模型和库存警戒线。"
            alignRightColumns={[1, 3, 4, 5, 6, 8]}
          />
        </section>
      )}

      {tab === "models" && (
        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <FormSection title="登记模型文件" description="模型文件可以绑定到具体 SKU，也可以作为产品通用默认模型。">
            <form action="/api/products/models" method="post" className="space-y-4">
              <input type="hidden" name="action" value="create" />
              <input type="hidden" name="productId" value={id} />
              <Input name="name" label="模型名称" required />
              <Input name="fileUrl" label="模型文件地址" required />
              <label className="block text-sm font-medium text-slate-700">文件格式<select name="fileType" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option>STL</option><option>3MF</option><option>OBJ</option><option>STEP</option><option>GCODE</option><option>OTHER</option></select></label>
              <label className="block text-sm font-medium text-slate-700">关联 SKU<select name="skuId" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="">产品通用模型</option>{product.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.skuCode} · {sku.name}</option>)}</select></label>
              <label className="block text-sm font-medium text-slate-700">打印参数 JSON<textarea name="printSettings" placeholder={'{"layerHeight":0.2,"infill":15}'} className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2 text-sm" /></label>
              <Input name="remark" label="版本说明" />
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">保存模型文件</button>
            </form>
          </FormSection>
          <DataTable
            headers={["版本", "模型", "格式", "关联 SKU", "文件", "状态", "默认模型", "操作"]}
            rows={product.models.map((model) => [
              `v${model.version}`,
              model.name,
              model.fileType,
              product.skus.find((sku) => sku.id === model.skuId)?.skuCode ?? "产品通用",
              <a key={`${model.id}-file`} className="font-semibold text-brand" href={model.fileUrl} target="_blank" rel="noreferrer">打开文件</a>,
              <StatusBadge key={`${model.id}-status`} tone={model.status === "ACTIVE" ? "success" : "neutral"}>{model.status}</StatusBadge>,
              model.isCurrent ? <StatusBadge key={`${model.id}-current`} tone="success">默认模型</StatusBadge> : "-",
              <div key={`${model.id}-actions`} className="flex justify-end gap-3">
                {!model.isCurrent && model.status === "ACTIVE" && <form action="/api/products/models" method="post"><input type="hidden" name="action" value="adopt" /><input type="hidden" name="productId" value={id} /><input type="hidden" name="modelId" value={model.id} /><button className="font-semibold text-brand">设为默认</button></form>}
                {model.status === "ACTIVE" && <form action="/api/products/models" method="post"><input type="hidden" name="action" value="archive" /><input type="hidden" name="productId" value={id} /><input type="hidden" name="modelId" value={model.id} /><button className="font-semibold text-rose-600">归档</button></form>}
              </div>
            ])}
            emptyText="暂无模型文件"
            emptyDescription="登记 STL、3MF、OBJ、STEP 或 G-code 文件后，可作为 SKU 的生产依据。"
            alignRightColumns={[7]}
          />
        </section>
      )}

      {tab === "content" && (
        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <FormSection title="AI 标题" description="生成电商标题候选，人工审核后采用。">
              <form action="/api/products/growth" method="post" className="space-y-4">
                <input type="hidden" name="action" value="generate-title" />
                <input type="hidden" name="productId" value={id} />
                <Input name="platform" label="平台" required defaultValue="拼多多" />
                <Input name="keywords" label="核心/长尾关键词" required />
                <Input name="sellingPoints" label="卖点" required />
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">生成标题候选</button>
              </form>
            </FormSection>
            <FormSection title="AI 详情页" description="生成详情页模块文案，适合拼多多、淘宝、Etsy 等平台。">
              <form action="/api/products/growth" method="post" className="space-y-4">
                <input type="hidden" name="action" value="generate-detail" />
                <input type="hidden" name="productId" value={id} />
                <Input name="platform" label="平台" required defaultValue="拼多多" />
                <Input name="sellingPoints" label="卖点" required />
                <Input name="audience" label="目标人群" />
                <Input name="scenarios" label="适用场景" />
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">生成详情页版本</button>
              </form>
            </FormSection>
            <FormSection title="AI 主图" description="第一版先生成主图策划和 Prompt，后续接入任务队列。">
              <form action="/api/products/growth" method="post" className="space-y-4">
                <input type="hidden" name="action" value="create-image-workflow" />
                <input type="hidden" name="productId" value={id} />
                <Input name="platform" label="平台" required defaultValue="拼多多" />
                <Input name="assetType" label="主图类型" required defaultValue="白底主图" />
                <Input name="sourceUrl" label="原始素材地址" />
                <Input name="sellingPoints" label="需要突出卖点" required />
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">生成主图策划</button>
              </form>
            </FormSection>
          </div>
          <DataTable headers={["版本", "平台", "标题", "评分", "审核状态", "当前采用", "操作"]} rows={product.titleVersions.map((item) => [item.version, item.platform, item.title, item.score.toFixed(1), item.reviewStatus, item.isCurrent ? "是" : "-", <ContentActions key={item.id} productId={id} contentId={item.id} contentType="title" isCurrent={item.isCurrent} />])} emptyText="暂无 AI 标题" alignRightColumns={[0, 3, 6]} />
          <DataTable headers={["类型", "平台", "策划说明", "生成 Prompt", "审核状态", "使用状态", "操作"]} rows={product.contentAssets.map((item) => [item.assetType, item.platform ?? "-", item.planText ?? "-", item.generatedPrompt ?? "-", item.reviewStatus, item.usageStatus, <ContentActions key={item.id} productId={id} contentId={item.id} contentType="asset" isCurrent={item.usageStatus === "ACTIVE"} />])} emptyText="暂无 AI 主图工作流" alignRightColumns={[6]} />
          <DataTable headers={["版本", "平台", "AI 内容", "审核状态", "当前采用", "操作"]} rows={product.detailVersions.map((item) => [item.version, item.platform, item.aiContent ?? "-", item.reviewStatus, item.isCurrent ? "是" : "-", <ContentActions key={item.id} productId={id} contentId={item.id} contentType="detail" isCurrent={item.isCurrent} />])} emptyText="暂无 AI 详情页" alignRightColumns={[0, 5]} />
        </section>
      )}

      {tab === "competitors" && (
        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
            <FormSection title={`添加竞品（${activeCompetitors.length}/5）`} description="每个产品最多 5 个竞品链接。第一版支持手动录入、表格导入和半自动分析。">
              <form action="/api/products/growth" method="post" className="space-y-4">
                <input type="hidden" name="action" value="add-competitor" />
                <input type="hidden" name="productId" value={id} />
                <Input name="platform" label="平台" required />
                <Input name="competitorUrl" label="竞品链接" required />
                <Input name="title" label="竞品标题" />
                <Input name="currentPrice" label="当前价格" type="number" />
                <Input name="salesDisplayValue" label="salesDisplayValue 销量展示值" />
                <Input name="salesEstimate" label="salesEstimate 销量估算值" type="number" />
                <Input name="salesActual" label="salesActual 真实销量" type="number" />
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">添加竞品并保存快照</button>
              </form>
            </FormSection>
            <div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 text-sm leading-6 text-slate-700">
                竞品监控只在产品中心和产品详情里出现，不做独立一级菜单。销量展示值、估算值、真实销量必须分开维护，避免把平台展示文案误当真实销量。
              </div>
              <DataTable
                headers={["时间", "提醒", "说明", "变化", "状态", "操作"]}
                rows={product.competitorAlerts.map((alert) => [
                  alert.createdAt.toLocaleString("zh-CN"),
                  alert.title,
                  alert.description,
                  `${alert.previousValue ?? "-"} -> ${alert.currentValue ?? "-"}`,
                  <StatusBadge key={alert.id} tone={alert.status === "UNREAD" ? "warning" : "neutral"}>{alert.status}</StatusBadge>,
                  alert.status === "READ" ? "-" : <form key={`${alert.id}-form`} action="/api/products/growth" method="post"><input type="hidden" name="action" value="mark-alert-read" /><input type="hidden" name="productId" value={id} /><input type="hidden" name="alertId" value={alert.id} /><button className="font-semibold text-brand">标记已读</button></form>
                ])}
                emptyText="暂无竞品变化提醒"
              />
            </div>
          </div>
          <DataTable
            headers={["平台", "竞品标题", "价格", "salesDisplayValue", "salesEstimate", "salesActual", "来源", "状态", "操作"]}
            rows={product.competitors.map((item) => [
              item.platform,
              item.title ?? item.competitorUrl,
              money(item.currentPrice),
              item.salesDisplayValue ?? "-",
              item.salesEstimate?.toString() ?? "-",
              item.salesActual?.toString() ?? "-",
              item.dataSource,
              <StatusBadge key={item.id} tone={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status}</StatusBadge>,
              <Link key={`${item.id}-detail`} className="font-semibold text-brand" href={`/app/products/${id}?tab=competitors#${item.id}`}>查看快照</Link>
            ])}
            emptyText="暂无竞品"
            emptyDescription="最多绑定 5 个竞品链接，可手动录入或 CSV 导入。"
            alignRightColumns={[2, 4, 5, 8]}
          />
        </section>
      )}
    </div>
  );
}





