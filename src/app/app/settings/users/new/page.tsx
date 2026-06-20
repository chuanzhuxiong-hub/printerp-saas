import { Field, FormShell, SelectField } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";

export default async function NewUserPage() {
  const session = await requireSession();
  if (!["OWNER", "MANAGER"].includes(session.role)) return <main><h1 className="text-2xl font-bold">无权管理员工</h1></main>;
  const roles = [
    ["MANAGER", "店长"], ["PRODUCTION", "生产员"], ["WAREHOUSE", "仓库员"], ["FINANCE", "财务"], ["SUPPORT", "客服"]
  ].map(([value, label]) => ({ value, label }));
  return <FormShell title="新增员工账号" description="创建员工登录账号并分配基础业务角色。" action="/api/users" backHref="/app/settings/users">
    <Field label="姓名" name="name" required />
    <Field label="邮箱" name="email" type="email" required />
    <Field label="初始密码" name="password" type="password" required />
    <SelectField label="角色" name="role" required options={roles} />
  </FormShell>;
}
