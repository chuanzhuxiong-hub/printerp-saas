import { Prisma } from "@prisma/client";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const [expenses, categories] = await Promise.all([
    db.expense.findMany({ where: { tenantId: session.tenantId, deletedAt: null }, orderBy: { occurredAt: "desc" }, take: 200 }),
    db.expenseCategory.findMany({ where: { tenantId: session.tenantId, deletedAt: null } })
  ]);
  const categoryMap = new Map(categories.map(item => [item.id, item.name]));
  const total = expenses.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  return <main>
    <PageHeader title="经营费用" description={`最近 ${expenses.length} 笔费用，合计 ${total.toFixed(2)}。`} actionHref="/app/expenses/new" actionLabel="记录费用" />
    {query.created && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">经营费用已记录。</p>}
    <DataTable headers={["发生日期", "分类", "费用名称", "金额", "备注"]} rows={expenses.map(item => [
      item.occurredAt.toLocaleDateString("zh-CN"), item.categoryId ? categoryMap.get(item.categoryId) ?? "-" : "-", item.name, item.amount.toString(), item.remark ?? "-"
    ])} />
  </main>;
}
