import { notFound } from "next/navigation";
import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const item = await db.shop.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } }); if (!item) notFound();
  return <FormShell title="编辑店铺" description="修改店铺联系人与备注。" action={`/api/shops/${item.id}`} backHref="/app/settings/shops"><Field label="店铺名称" name="name" required defaultValue={item.name} /><Field label="联系人" name="contactName" defaultValue={item.contactName ?? ""} /><Field label="备注" name="remark" defaultValue={item.remark ?? ""} /></FormShell>;
}
