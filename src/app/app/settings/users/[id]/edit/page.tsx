import { notFound } from "next/navigation";
import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const member = await db.tenantUser.findFirst({ where: { id, tenantId: session.tenantId }, include: { user: true } });
  if (!member) notFound();
  const roles = [["MANAGER", "店长"], ["PRODUCTION", "生产员"], ["WAREHOUSE", "仓库员"], ["FINANCE", "财务"], ["SUPPORT", "客服"]].map(([value, label]) => ({ value, label }));
  if (member.role === "OWNER") roles.unshift({ value: "OWNER", label: "商家老板" });
  return <FormShell title="编辑员工账号" description="修改员工角色或停用账号。" action={`/api/users/${member.id}`} backHref="/app/settings/users">
    <Field label="姓名" name="name" required defaultValue={member.user.name} />
    <Field label="邮箱" name="email" type="email" defaultValue={member.user.email} />
    <SelectField label="角色" name="role" required defaultValue={member.role} options={roles} />
    <SelectField label="状态" name="status" required defaultValue={member.status} options={[{ value: "ACTIVE", label: "启用" }, { value: "DISABLED", label: "停用" }]} />
  </FormShell>;
}
