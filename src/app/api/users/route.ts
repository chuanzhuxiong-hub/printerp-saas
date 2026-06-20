import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, text, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { canAssignEmployeeRole, isUserRole } from "@/lib/permissions";

async function handlePost(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (!auth.session) return auth.response;
  const session = auth.session;
  const form = await request.formData();
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const role = text(form, "role");
  if (!isUserRole(session.role) || !isUserRole(role) || !canAssignEmployeeRole(session.role, role)) {
    return NextResponse.json({ error: "无权分配该员工角色" }, { status: 403 });
  }
  if (password.length < 8) throw new Error("初始密码至少 8 位");

  await db.$transaction(async tx => {
    const existing = await tx.user.findUnique({ where: { email } });
    const user = existing ?? await tx.user.create({
      data: { email, name: text(form, "name"), passwordHash: await bcrypt.hash(password, 12) }
    });
    await tx.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: session.tenantId, userId: user.id } },
      update: { role, status: "ACTIVE" },
      create: { tenantId: session.tenantId, userId: user.id, role, status: "ACTIVE" }
    });
    await tx.auditLog.create({
      data: { tenantId: session.tenantId, userId: session.userId, action: "tenant_user.created", entityType: "User", entityId: user.id, metadata: { role, existingUser: Boolean(existing) } }
    });
  });
  return NextResponse.redirect(new URL("/app/settings/users", process.env.APP_URL ?? request.url), 303);
}

export const POST = withApiLogging("users.post", handlePost);
