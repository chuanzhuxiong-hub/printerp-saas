import { Prisma } from "@prisma/client";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageCount, parsePagination } from "@/lib/pagination";

type TabKey = "library" | "ai" | "competitors" | "opportunities";

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  { key: "library", label: "产品库", description: "产品、SKU 展开、BOM / 打印配方、默认模型和库存警戒线" },
  { key: "ai", label: "AI 工作流", description: "AI 标题、AI 主图、AI 详情页集中在产品中心" },
  { key: "competitors", label: "竞品监控", description: "每个产品最多 5 个竞品，销量字段分开记录" },
  { key: "opportunities", label: "自动选品池", description: "手动录入、表格导入和半自动分析" }
];

function contentScore(counts: { titleVersions: number; contentAssets: number; detailVersions: number; competitors: number; skus: number }) {
  return Math.round(
    (counts.titleVersions ? 20 : 0)
    + Math.min(counts.contentAssets, 3) / 3 * 25
    + (counts.detailVersions ? 25 : 0)
    + Math.min(counts.competitors, 5) / 5 * 15
    + (counts.skus ? 15 : 0)
  );
}

function statusTone(value: boolean): "success" | "danger" {
  return value ? "success" : "danger";
}

function money(value: Prisma.Decimal | number | string) {
  return `¥${new Prisma.Decimal(value).toFixed(2)}`;
}

function activeTab(value?: string): TabKey {
  return tabs.some((tab) => tab.key === value) ? value as TabKey : "library";
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; saved?: string; message?: string; error?: string; keyword?: string; status?: string; minScore?: string; page?: string; pageSize?: string }>;
}) {
  const session = await requireSession();
  const query = await searchParams;
  const active = activeTab(query.tab);
  const pagination = parsePagination(query, { pageSize: 20, maxPageSize: 100 });
  const keyword = query.keyword?.trim();
  const productStatus = query.status ?? "ALL";

  const productWhere: Prisma.ProductWhereInput = {
    tenantId: session.tenantId,
    deletedAt: null,
    isActive: productStatus === "ACTIVE" ? true : productStatus === "INACTIVE" ? false : undefined,
    OR: keyword ? [
      { name: { contains: keyword, mode: "insensitive" } },
      { category: { contains: keyword, mode: "insensitive" } },
      { skus: { some: { skuCode: { contains: keyword, mode: "insensitive" }, deletedAt: null } } },
      { skus: { some: { name: { contains: keyword, mode: "insensitive" }, deletedAt: null } } }
    ] : undefined
  };

  const [products, productTotal] = await Promise.all([
    db.product.findMany({
      where: productWhere,
      include: {
        skus: { where: { deletedAt: null }, include: { bom: true }, orderBy: { createdAt: "desc" } },
        models: { where: { status: "ACTIVE" }, orderBy: [{ isCurrent: "desc" }, { version: "desc" }] },
        _count: { select: { skus: true, titleVersions: true, contentAssets: true, detailVersions: true, competitors: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take
    }),
    db.product.count({ where: productWhere })
  ]);

  const productSkuIds = products.flatMap((product) => product.skus.map((sku) => sku.id));
  const inventoryItems = productSkuIds.length
    ? await db.inventoryItem.findMany({
        where: { tenantId: session.tenantId, category: "PRODUCT", refId: { in: productSkuIds }, deletedAt: null }
      })
    : [];
  const inventoryByRefId = new Map(inventoryItems.map((item) => [item.refId, item]));
  const productRiskCount = products.reduce((count, product) => count + product.skus.filter((sku) => {
    const inventory = inventoryByRefId.get(sku.id);
    const lowStock = inventory ? inventory.quantity.lte(sku.warningStock) : false;
    const lowProfit = sku.bom ? sku.salePrice.minus(sku.bom.estimatedProductCost).lte(0) : false;
    return !sku.bom || lowStock || lowProfit;
  }).length, 0);

  const minScore = Number(query.minScore ?? "0") || 0;
  const [competitorAlerts, competitors, opportunities] = await Promise.all([
    active === "competitors"
      ? db.competitorAlert.findMany({ where: { tenantId: session.tenantId }, include: { product: true, competitor: true }, orderBy: { createdAt: "desc" }, take: 80 })
      : Promise.resolve([]),
    active === "competitors"
      ? db.productCompetitor.findMany({ where: { tenantId: session.tenantId, status: "ACTIVE" }, include: { product: true }, orderBy: { updatedAt: "desc" }, take: 200 })
      : Promise.resolve([]),
    active === "opportunities"
      ? db.productOpportunity.findMany({
          where: {
            tenantId: session.tenantId,
            status: query.status && query.status !== "ALL" ? query.status : undefined,
            opportunityScore: { gte: minScore },
            OR: keyword ? [
              { keyword: { contains: keyword, mode: "insensitive" } },
              { title: { contains: keyword, mode: "insensitive" } },
              { category: { contains: keyword, mode: "insensitive" } }
            ] : undefined
          },
          orderBy: { opportunityScore: "desc" },
          take: 200
        })
      : Promise.resolve([])
  ]);

  const totalPages = pageCount(productTotal, pagination.pageSize);
  const pageHref = (page: number) => `/app/products?tab=${active}&keyword=${encodeURIComponent(keyword ?? "")}&status=${productStatus}&page=${page}&pageSize=${pagination.pageSize}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product Operations"
        title="产品中心"
        description="把 SPU、SKU 展开、BOM / 打印配方、默认模型、库存警戒线、AI 标题、AI 主图、AI 详情页、竞品监控和自动选品池集中在一个产品工作台。"
        actionHref="/app/products/new"
        actionLabel="新增产品"
      />

      {query.saved && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.message ?? "产品中心操作已保存。"}</p>}
      {query.error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{query.error}</p>}

      <div className="grid gap-3 md:grid-cols-4">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/app/products?tab=${tab.key}`}
            className={`rounded-2xl border p-4 shadow-sm transition ${active === tab.key ? "border-blue-200 bg-blue-50 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}
          >
            <p className="font-semibold">{tab.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{tab.description}</p>
          </Link>
        ))}
      </div>

      <section className="grid gap-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="font-semibold text-ink">风险提示</h2>
          <p className="mt-1 text-sm text-slate-600">当前筛选结果中有 {productRiskCount} 个 SKU 存在未配置 BOM、低利润或低库存风险。低利润会影响订单净利，低库存会影响生产和发货。</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <StatusBadge tone={productRiskCount ? "warning" : "success"}>{productRiskCount ? "需要处理" : "风险正常"}</StatusBadge>
          <Link href="/app/products?tab=library" className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand shadow-sm hover:bg-blue-50">操作面板</Link>
        </div>
      </section>

      {active === "library" && (
        <section className="space-y-5">
          <FilterBar action={<Link href="/app/products/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">新增产品</Link>}>
            <form action="/app/products" method="get" className="flex w-full flex-wrap items-center gap-3">
              <input type="hidden" name="tab" value="library" />
              <input name="keyword" defaultValue={keyword} placeholder="搜索产品、分类、SKU 编码" className="min-w-[260px] flex-1 rounded-lg border px-3 py-2 text-sm" />
              <select name="status" defaultValue={productStatus} className="rounded-lg border px-3 py-2 text-sm">
                <option value="ALL">全部状态</option>
                <option value="ACTIVE">只看启用</option>
                <option value="INACTIVE">只看停用</option>
              </select>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">筛选</button>
              <Link href="/app/products" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">重置</Link>
            </form>
          </FilterBar>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.5fr_120px_110px_120px_130px_150px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>产品 / SKU 展开</span>
              <span>SKU</span>
              <span>竞品</span>
              <span>内容分</span>
              <span>状态</span>
              <span className="text-right">操作</span>
            </div>
            <div className="divide-y divide-slate-100">
              {products.map((product) => {
                const score = contentScore(product._count);
                const activeCompetitorCount = product._count.competitors;
                const productModels = product.models.filter((model) => !model.skuId);
                return (
                  <details key={product.id} className="group" open>
                    <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5 lg:grid lg:grid-cols-[1.5fr_120px_110px_120px_130px_150px] lg:items-center lg:gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 group-open:bg-brand group-open:text-white">展开</span>
                          <Link href={`/app/products/${product.id}`} className="truncate text-base font-semibold text-ink hover:text-brand">{product.name}</Link>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{product.category ?? "未分类"} · 默认模型 {productModels.length ? `${productModels.length} 个` : "未绑定"}</p>
                      </div>
                      <span className="text-sm font-semibold text-ink lg:text-base"><span className="text-slate-400 lg:hidden">SKU：</span>{product.skus.length}</span>
                      <span className="text-sm text-slate-600 lg:text-base"><span className="text-slate-400 lg:hidden">竞品：</span>{activeCompetitorCount}/5</span>
                      <span className="text-sm tabular-nums text-slate-600 lg:text-base"><span className="text-slate-400 lg:hidden">完成度：</span>{score}%</span>
                      <StatusBadge tone={statusTone(product.isActive)}>{product.isActive ? "启用" : "停用"}</StatusBadge>
                      <div className="flex gap-3 text-sm lg:justify-end">
                        <Link className="font-semibold text-brand" href={`/app/products/${product.id}`}>详情</Link>
                        <Link className="font-semibold text-brand" href={`/app/products/${product.id}?tab=content`}>AI</Link>
                      </div>
                    </summary>
                    <div className="bg-slate-50/70 px-5 pb-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-ink">SKU 展开管理</h3>
                            <p className="mt-1 text-sm text-slate-500">SKU 是真实销售、库存、生产和利润核算对象，BOM / 打印配方、默认模型和库存警戒线都在这里检查。</p>
                          </div>
                          <Link href={`/app/skus/new?productId=${product.id}&returnTo=/app/products`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">添加 SKU</Link>
                        </div>
                        <div className="mb-2 text-xs text-slate-500 sm:hidden">SKU 明细可左右滑动查看完整字段</div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[920px] text-sm">
                            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                              <tr className="border-b border-slate-100">
                                <th className="py-3">SKU</th>
                                <th className="py-3">售价</th>
                                <th className="py-3">颜色/规格</th>
                                <th className="py-3">默认耗材</th>
                                <th className="py-3 text-right">理论克重</th>
                                <th className="py-3 text-right">打印时间</th>
                                <th className="py-3 text-right">预估成本</th>
                                <th className="py-3 text-right">库存警戒线</th>
                                <th className="py-3">配置状态</th>
                                <th className="py-3 text-right">操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {product.skus.map((sku) => {
                                const modelCount = product.models.filter((model) => model.skuId === sku.id || (!model.skuId && model.isCurrent)).length;
                                const inventory = inventoryByRefId.get(sku.id);
                                const lowStock = inventory ? inventory.quantity.lte(sku.warningStock) : false;
                                const lowProfit = sku.bom ? sku.salePrice.minus(sku.bom.estimatedProductCost).lte(0) : false;
                                return (
                                  <tr key={sku.id}>
                                    <td className="py-3"><div className="font-semibold text-ink">{sku.name}</div><div className="text-xs text-slate-500">{sku.skuCode}</div></td>
                                    <td className="py-3 tabular-nums">{money(sku.salePrice)}</td>
                                    <td className="py-3">{[sku.color, sku.size].filter(Boolean).join(" / ") || "未设置"}</td>
                                    <td className="py-3">{sku.bom?.defaultMaterialId ? "已绑定" : <StatusBadge tone="warning">未绑定耗材</StatusBadge>}</td>
                                    <td className="py-3 text-right tabular-nums">{sku.bom?.theoreticalGrams.toFixed(3) ?? "-"}g</td>
                                    <td className="py-3 text-right tabular-nums">{sku.bom?.estimatedPrintHours.toFixed(2) ?? "-"}h</td>
                                    <td className="py-3 text-right tabular-nums">{sku.bom ? money(sku.bom.estimatedProductCost) : "-"}</td>
                                    <td className="py-3 text-right tabular-nums">{sku.warningStock.toFixed(3)}</td>
                                    <td className="py-3">
                                      <div className="flex flex-wrap gap-2">
                                        <StatusBadge tone={sku.bom ? "success" : "warning"}>{sku.bom ? "已配置 BOM" : "未配置 BOM"}</StatusBadge>
                                        <StatusBadge tone={modelCount ? "success" : "warning"}>{modelCount ? "已绑定模型" : "未绑定模型"}</StatusBadge>
                                        {lowProfit && <StatusBadge tone="danger">低利润</StatusBadge>}
                                        {lowStock && <StatusBadge tone="danger">低库存</StatusBadge>}
                                      </div>
                                    </td>
                                    <td className="py-3 text-right">
                                      <div className="flex justify-end gap-3">
                                        <Link className="font-semibold text-brand" href={`/app/skus/${sku.id}/edit`}>编辑</Link>
                                        <Link className="font-semibold text-brand" href={sku.bom ? `/app/boms/${sku.bom.id}/edit` : `/app/boms/new?skuId=${sku.id}&returnTo=/app/products`}>{sku.bom ? "编辑 BOM" : "设置 BOM"}</Link>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {!product.skus.length && (
                                <tr><td colSpan={10} className="py-8 text-center text-slate-500">该产品还没有 SKU，请先添加 SKU 后再配置 BOM、模型和库存警戒线。</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
              {!products.length && <div className="px-5 py-12 text-center text-slate-500">暂无产品，请新增产品并配置 SKU。</div>}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            <span>第 {pagination.page} / {totalPages} 页，每页 {pagination.pageSize} 个产品，本页 {products.length} 个</span>
            <div className="flex gap-2">
              <Link href={pageHref(Math.max(pagination.page - 1, 1))} className={`rounded-lg border px-3 py-2 font-semibold ${pagination.page <= 1 ? "pointer-events-none opacity-50" : "bg-white text-brand"}`}>上一页</Link>
              <Link href={pageHref(Math.min(pagination.page + 1, totalPages))} className={`rounded-lg border px-3 py-2 font-semibold ${pagination.page >= totalPages ? "pointer-events-none opacity-50" : "bg-white text-brand"}`}>下一页</Link>
            </div>
          </div>
        </section>
      )}

      {active === "ai" && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm leading-6 text-slate-700">
            AI 标题、AI 主图、AI 详情页工作流必须集成在产品中心。第一版先生成策划、Prompt 和候选文案，人工审核后采用；后续再接任务队列和合规 AI 服务。
          </div>
          <DataTable
            headers={["产品", "AI 标题", "AI 主图", "AI 详情页", "内容完整度", "操作"]}
            rows={products.map((product) => [
              <Link key={product.id} href={`/app/products/${product.id}?tab=content`} className="font-semibold text-brand">{product.name}</Link>,
              product._count.titleVersions,
              product._count.contentAssets,
              product._count.detailVersions,
              `${contentScore(product._count)}%`,
              <Link key={`${product.id}-content`} href={`/app/products/${product.id}?tab=content`} className="font-semibold text-brand">进入 AI 工作流</Link>
            ])}
            alignRightColumns={[1, 2, 3, 4]}
          />
        </section>
      )}

      {active === "competitors" && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 text-sm leading-6 text-slate-700">
            竞品监控集成在产品中心和产品详情里，不单独做一级菜单。每个产品最多 5 个竞品；销量必须区分 salesDisplayValue、salesEstimate、salesActual。第一版支持手动录入、表格导入和半自动分析。
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">竞品异常提醒</h2>
            <DataTable
              headers={["时间", "产品", "竞品", "提醒", "变化", "状态", "操作"]}
              rows={competitorAlerts.map((alert) => [
                alert.createdAt.toLocaleString("zh-CN"),
                alert.product.name,
                alert.competitor.title ?? alert.competitor.platform,
                alert.title,
                `${alert.previousValue ?? "-"} -> ${alert.currentValue ?? "-"}`,
                <StatusBadge key={alert.id} tone={alert.status === "UNREAD" ? "warning" : "neutral"}>{alert.status}</StatusBadge>,
                <Link key={`${alert.id}-link`} className="font-semibold text-brand" href={`/app/products/${alert.productId}?tab=competitors`}>处理</Link>
              ])}
              emptyText="暂无竞品异常提醒"
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">全部启用竞品</h2>
            <DataTable
              headers={["产品", "平台", "竞品标题", "当前价格", "salesDisplayValue", "salesEstimate", "salesActual", "来源", "操作"]}
              rows={competitors.map((item) => [
                item.product.name,
                item.platform,
                item.title ?? "-",
                money(item.currentPrice),
                item.salesDisplayValue ?? "-",
                item.salesEstimate?.toString() ?? "-",
                item.salesActual?.toString() ?? "-",
                item.dataSource,
                <Link key={item.id} className="font-semibold text-brand" href={`/app/products/${item.productId}?tab=competitors`}>查看</Link>
              ])}
              alignRightColumns={[3, 5, 6]}
            />
          </div>
        </section>
      )}

      {active === "opportunities" && (
        <section className="space-y-5">
          <FilterBar>
            <form action="/app/products" method="get" className="flex w-full flex-wrap items-center gap-3">
              <input type="hidden" name="tab" value="opportunities" />
              <input name="keyword" defaultValue={keyword} placeholder="搜索关键词、标题或类目" className="min-w-[260px] flex-1 rounded-lg border px-3 py-2 text-sm" />
              <select name="status" defaultValue={query.status ?? "ALL"} className="rounded-lg border px-3 py-2 text-sm">
                <option value="ALL">全部状态</option>
                <option value="PENDING">待评估</option>
                <option value="SHORTLISTED">已入围</option>
                <option value="REJECTED">已淘汰</option>
                <option value="CONVERTED">已转产品</option>
              </select>
              <input name="minScore" type="number" defaultValue={query.minScore ?? "0"} placeholder="最低评分" className="w-28 rounded-lg border px-3 py-2 text-sm" />
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">筛选</button>
            </form>
          </FilterBar>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm leading-6 text-slate-700">
            自动选品池集成在产品中心，不单独做一级菜单。第一版支持手动录入、表格导入和半自动分析，后续再接合规 API 或第三方数据服务。
          </div>
          <DataTable
            headers={["关键词", "平台", "候选商品", "状态", "价格", "salesDisplayValue", "salesEstimate", "salesActual", "预计毛利率", "机会评分", "建议", "操作"]}
            rows={opportunities.map((item) => [
              item.keyword,
              item.platform,
              item.title,
              <StatusBadge key={item.id} tone={item.status === "SHORTLISTED" ? "success" : item.status === "REJECTED" ? "danger" : "neutral"}>{item.status}</StatusBadge>,
              money(item.price),
              item.salesDisplayValue ?? "-",
              item.salesEstimate?.toString() ?? "-",
              item.salesActual?.toString() ?? "-",
              `${item.estimatedMargin.mul(100).toFixed(1)}%`,
              item.opportunityScore.toFixed(1),
              item.aiRecommendation ?? "-",
              item.status === "CONVERTED" ? "已转产品" : <form key={`${item.id}-form`} action="/api/products/growth" method="post"><input type="hidden" name="action" value="convert-opportunity" /><input type="hidden" name="opportunityId" value={item.id} /><button className="font-semibold text-brand">转产品草稿</button></form>
            ])}
            alignRightColumns={[4, 6, 7, 8, 9]}
            emptyText="暂无选品候选"
            emptyDescription="可以在产品详情或导入模板中维护候选商品，系统会计算机会评分和预计毛利率。"
          />
        </section>
      )}
    </div>
  );
}





