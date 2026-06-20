import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { resetTenantData } from "@/lib/data-reset";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  if (session.role !== "OWNER") return NextResponse.json({ error: "只有商家老板可以初始化数据" }, { status: 403 });
  const form = await request.formData();
  const scope = text(form, "scope") as "OPERATIONS" | "ALL";
  const expected = scope === "OPERATIONS" ? "清空经营数据" : scope === "ALL" ? "初始化全部数据" : "";
  if (!expected || text(form, "confirmation") !== expected) {
    return NextResponse.redirect(new URL(`/app/settings/data?error=${encodeURIComponent("确认短语不正确，未执行任何操作")}`, process.env.APP_URL ?? request.url), 303);
  }

  await db.$transaction(async tx => {
    await resetTenantData(tx, session.tenantId, scope);
    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: scope === "ALL" ? "tenant.business-data-reset" : "tenant.operational-data-cleared",
        entityType: "Tenant",
        entityId: session.tenantId,
        metadata: { scope }
      }
    });
  }, { timeout: 30000 });

  const success = scope === "ALL" ? "全部业务数据已初始化，账号和商家空间已保留" : "经营数据已清空，基础资料和账号已保留";
  return NextResponse.redirect(new URL(`/app/settings/data?success=${encodeURIComponent(success)}`, process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("data-management.post", handlePost);
