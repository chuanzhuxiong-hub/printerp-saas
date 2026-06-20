import { TenantUserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { canAssignEmployeeRole, isUserRole } from "@/lib/permissions";

async function handlePost(request: Request, logContext: RequestLogContext, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const { id } = await context.params;
  const form = await request.formData();
  const member = await db.tenantUser.findFirstOrThrow({ where: { id, tenantId: session.tenantId }, include: { user: true } });
  const status = text(form, "status") as TenantUserStatus;
  const role = text(form, "role");
  if (session.role === "MANAGER" && member.role === "OWNER") {
    return NextResponse.json({ error: "店长无权管理老板账号" }, { status: 403 });
  }
  if (!isUserRole(session.role) || !isUserRole(role)) {
    return NextResponse.json({ error: "无权分配该员工角色" }, { status: 403 });
  }
  if (member.role !== "OWNER" && !canAssignEmployeeRole(session.role, role)) {
    return NextResponse.json({ error: "无权分配该员工角色" }, { status: 403 });
  }
  if (member.role === "OWNER" && status !== "ACTIVE") throw new Error("商家老板账号不能停用");
  if (member.userId === session.userId && status !== "ACTIVE") throw new Error("不能停用当前登录账号");

  await db.$transaction(async tx => {
    await tx.user.update({ where: { id: member.userId }, data: { name: text(form, "name") } });
    const updated = await tx.tenantUser.update({
      where: { id: member.id },
      data: { role: member.role === "OWNER" ? "OWNER" : role, status }
    });
    await tx.auditLog.create({
      data: { tenantId: session.tenantId, userId: session.userId, action: "tenant_user.updated", entityType: "TenantUser", entityId: updated.id, metadata: { role: updated.role, status: updated.status } }
    });
  });
  return NextResponse.redirect(new URL("/app/settings/users", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("users.by-id.post", handlePost);
