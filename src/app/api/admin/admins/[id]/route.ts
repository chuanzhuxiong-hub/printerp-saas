import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { platformAdminSuccessResponse, requirePlatformApiSuperAdminRequest } from "@/lib/platform-auth";
import { requestIp } from "@/lib/rate-limit";

const actions = {
  disable: "platform_admin.disabled",
  enable: "platform_admin.enabled",
  "reset-password": "platform_admin.password_reset"
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformApiSuperAdminRequest(request);
  if (!auth.session) return auth.response;
  const { id } = await params;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "") as keyof typeof actions;
  if (!actions[intent]) return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  if (id === auth.session.platformAdminId) return NextResponse.json({ error: "Cannot manage self" }, { status: 403 });
  const target = await db.platformAdmin.findUnique({ where: { id } });
  if (!target || target.role !== "ADMIN") return NextResponse.json({ error: "Only ADMIN can be managed" }, { status: 403 });

  const password = String(form.get("password") ?? "");
  if (intent === "reset-password" && password.length < 12) {
    return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  }
  const passwordHash = intent === "reset-password" ? await bcrypt.hash(password, 12) : null;
  const now = new Date();
  const path = new URL(request.url).pathname;
  await db.$transaction(async tx => {
    if (intent === "disable") {
      await tx.platformAdmin.update({ where: { id }, data: { status: "DISABLED" } });
    } else if (intent === "enable") {
      await tx.platformAdmin.update({ where: { id }, data: { status: "ACTIVE" } });
    } else {
      await tx.platformAdmin.update({ where: { id }, data: { passwordHash: passwordHash! } });
    }
    if (intent === "disable" || intent === "reset-password") {
      await tx.platformAdminSession.updateMany({
        where: { platformAdminId: id, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.tenantAccessGrant.updateMany({
        where: { platformAdminId: id, revokedAt: null },
        data: { revokedAt: now }
      });
    }
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: auth.session.platformAdminId,
        action: actions[intent],
        requestMethod: request.method,
        requestPath: path,
        ipAddress: requestIp(request),
        entityType: "PlatformAdmin",
        entityId: id,
        metadata: intent === "reset-password" ? { credentialsChanged: true } : { status: intent === "enable" ? "ACTIVE" : "DISABLED" }
      }
    });
  });
  return platformAdminSuccessResponse(request, { ok: true });
}
