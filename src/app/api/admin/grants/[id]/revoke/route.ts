import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformApiSessionRequest } from "@/lib/platform-auth";
import { requestIp } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformApiSessionRequest(request);
  if (!auth.session) return auth.response;
  const { id } = await params;
  const now = new Date();
  const grant = await db.tenantAccessGrant.findFirst({
    where: { id, platformAdminId: auth.session.platformAdminId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, tenantId: true }
  });
  if (!grant) return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  const path = new URL(request.url).pathname;
  await db.$transaction(async tx => {
    await tx.tenantAccessGrant.update({ where: { id: grant.id }, data: { revokedAt: now } });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: auth.session!.platformAdminId,
        tenantId: grant.tenantId,
        accessGrantId: grant.id,
        action: "tenant_access_grant.revoked",
        requestMethod: request.method,
        requestPath: path,
        entityType: "TenantAccessGrant",
        entityId: grant.id,
        ipAddress: requestIp(request)
      }
    });
  });
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/admin/grants", process.env.APP_URL ?? request.url), 303);
  }
  return NextResponse.json({ ok: true });
}
