import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformSuperAdmin } from "@/lib/platform-auth";

function formatDate(value: Date | null) {
  return value ? value.toLocaleString("zh-CN") : "Never";
}

export default async function PlatformAdminsPage() {
  await requirePlatformSuperAdmin();
  const admins = await db.platformAdmin.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">PrintERP Platform</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">Platform Administrators</h1>
          <p className="mt-1 text-sm text-muted">Only super administrators can create, enable, disable, and reset ordinary platform administrators.</p>
        </div>
        <Link href="/admin" className="rounded-lg border px-4 py-2 text-sm font-semibold">Back to Platform Home</Link>
      </div>

      <form action="/api/admin/admins" method="post" className="grid gap-4 rounded-xl border bg-white p-5 shadow-soft md:grid-cols-4">
        <input type="hidden" name="role" value="ADMIN" />
        <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2.5" />
        <input name="email" type="email" required placeholder="Email" className="rounded-lg border px-3 py-2.5" />
        <input name="password" type="password" required minLength={12} placeholder="Initial password, at least 12 chars" className="rounded-lg border px-3 py-2.5" />
        <button className="rounded-lg bg-brand px-4 py-2.5 font-semibold text-white">Create Admin</button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-white shadow-soft">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-panel text-muted">
            <tr>
              {["Administrator", "Role", "Status", "Last Login", "Created At", "Actions"].map(item => (
                <th key={item} className="px-4 py-3">{item}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {admins.map(admin => (
              <tr key={admin.id}>
                <td className="px-4 py-4">
                  <strong>{admin.name}</strong>
                  <div className="text-muted">{admin.email}</div>
                </td>
                <td className="px-4 py-4">{admin.role}</td>
                <td className="px-4 py-4">{admin.status}</td>
                <td className="px-4 py-4">{formatDate(admin.lastLoginAt)}</td>
                <td className="px-4 py-4">{formatDate(admin.createdAt)}</td>
                <td className="px-4 py-4">
                  {admin.role === "ADMIN" ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={`/api/admin/admins/${admin.id}`} method="post">
                        <input type="hidden" name="intent" value={admin.status === "ACTIVE" ? "disable" : "enable"} />
                        <button className="rounded border px-3 py-1.5">{admin.status === "ACTIVE" ? "Disable" : "Enable"}</button>
                      </form>
                      <form action={`/api/admin/admins/${admin.id}`} method="post" className="flex gap-2">
                        <input type="hidden" name="intent" value="reset-password" />
                        <input name="password" type="password" required minLength={12} placeholder="New password" className="w-40 rounded border px-2 py-1.5" />
                        <button className="rounded border px-3 py-1.5">Reset Password</button>
                      </form>
                    </div>
                  ) : (
                    "Protected"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
