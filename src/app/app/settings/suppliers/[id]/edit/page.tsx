import { notFound } from "next/navigation";
import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const item = await db.supplier.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } }); if (!item) notFound();
  return <FormShell title="编辑供应商" description="修改供应商联系资料。" action={`/api/suppliers/${item.id}`} backHref="/app/settings/suppliers"><Field label="供应商名称" name="name" required defaultValue={item.name} /><Field label="联系人" name="contact" defaultValue={item.contact ?? ""} /><Field label="电话" name="phone" defaultValue={item.phone ?? ""} /><Field label="备注" name="remark" defaultValue={item.remark ?? ""} /></FormShell>;
}
