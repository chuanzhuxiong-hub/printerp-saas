import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function SkusPage() {
  const session = await requireSession();
  const skus = await db.productSku.findMany({
    where: { tenantId: session.tenantId, deletedAt: null },
    include: { product: true, bom: true },
    orderBy: { createdAt: "desc" }
  });
  return <main>
    <PageHeader title="SKU 管理" description={`当前共 ${skus.length} 个销售 SKU。`} actionHref="/app/skus/new" actionLabel="新增 SKU" />
    <DataTable headers={["SKU 编码", "SKU 名称", "产品", "规格", "售价", "警戒线", "状态", "BOM", "操作"]} rows={skus.map(item => [item.skuCode, item.name, item.product.name, [item.color, item.size, item.material].filter(Boolean).join(" / ") || "-", item.salePrice.toString(), item.warningStock.toString(), item.status, item.bom ? "已配置" : "未配置", <div className="flex gap-3"><Link className="font-semibold text-brand" href={`/app/skus/${item.id}/edit`}>编辑</Link><form action={`/api/skus/${item.id}`} method="post"><input type="hidden" name="intent" value="toggle" /><button className="font-semibold text-muted">{item.status === "ACTIVE" ? "停用" : "启用"}</button></form></div>])} />
  </main>;
}
