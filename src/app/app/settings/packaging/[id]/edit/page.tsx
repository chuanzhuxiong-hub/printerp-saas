import { notFound } from "next/navigation";
import { Field, FormShell } from "@/components/form-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EditPackagingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(); const { id } = await params;
  const item = await db.packagingItem.findFirst({ where: { id, tenantId: session.tenantId, deletedAt: null } }); if (!item) notFound();
  return <FormShell title="编辑包装材料" description="修改资料并同步包装库存主表。" action={`/api/packaging/${item.id}`} backHref="/app/settings/packaging"><Field label="名称" name="name" required defaultValue={item.name} /><Field label="规格" name="spec" defaultValue={item.spec ?? ""} /><Field label="单位" name="unit" required defaultValue={item.unit} /><Field label="库存警戒线" name="warningStock" type="number" step="0.001" defaultValue={item.warningStock.toString()} /><Field label="备注" name="remark" defaultValue={item.remark ?? ""} /></FormShell>;
}
