import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

const roleNames: Record<string, string> = { OWNER: "商家老板", MANAGER: "店长", PRODUCTION: "生产员", WAREHOUSE: "仓库员", FINANCE: "财务", SUPPORT: "客服" };

export default async function UsersPage() {
  const session = await requireSession();
  const users = await db.tenantUser.findMany({ where: { tenantId: session.tenantId }, include: { user: true }, orderBy: { createdAt: "asc" } });
  return <main>
    <PageHeader title="员工与权限" description={`当前共 ${users.length} 个商家账号，支持基础角色分工。`} actionHref={["OWNER", "MANAGER"].includes(session.role) ? "/app/settings/users/new" : undefined} actionLabel="新增员工" />
    <DataTable headers={["姓名", "邮箱", "角色", "状态", "加入时间", "操作"]} rows={users.map(item => [
      item.user.name, item.user.email, roleNames[item.role] ?? item.role, item.status, item.createdAt.toLocaleDateString("zh-CN"),
      <Link className="font-semibold text-brand" href={`/app/settings/users/${item.id}/edit`}>编辑</Link>
    ])} />
  </main>;
}
