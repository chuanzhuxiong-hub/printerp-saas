import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ToolAssetsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [assets, printers] = await Promise.all([db.toolAsset.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { purchaseDate: "desc" } }), db.printer.findMany({ where: { tenantId: session.tenantId }, select: { id: true, code: true, name: true } })]);
  const printerMap = new Map(printers.map(item => [item.id, `${item.code} · ${item.name}`]));
  const amount = assets.reduce((sum, item) => sum.plus(item.purchaseAmount), new Prisma.Decimal(0));
  const depreciation = assets.filter(item => item.status === "ACTIVE").reduce((sum, item) => sum.plus(item.monthlyDepreciation), new Prisma.Decimal(0));
  return <main><PageHeader title="生产工具与设备" description={`资产原值 ${amount.toFixed(2)}，当前每月折旧 ${depreciation.toFixed(2)}。`} actionHref="/app/tool-assets/new" actionLabel="新增工具设备" />
    {query.created && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">工具设备已登记并开始计算折旧。</p>}
    <DataTable headers={["编码", "名称", "分类", "数量", "购置日期", "购置金额", "使用月数", "月折旧", "配套打印机", "状态"]} rows={assets.map(item => [item.code, item.name, item.category, item.quantity.toString(), item.purchaseDate.toLocaleDateString("zh-CN"), item.purchaseAmount.toString(), item.usefulLifeMonths, item.monthlyDepreciation.toString(), item.assignedPrinterId ? printerMap.get(item.assignedPrinterId) ?? "-" : "通用", item.status])} />
  </main>;
}

