import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformApiSessionRequest } from "@/lib/platform-auth";
import { requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requirePlatformApiSessionRequest(request);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const tenantId = String(form.get("tenantId") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  if (!tenantId || !reason) return NextResponse.json({ error: "Tenant and reason are required" }, { status: 400 });
  const tenant = await db.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const path = new URL(request.url).pathname;
  const grant = await db.$transaction(async tx => {
    const now = new Date();
    await tx.tenantAccessGrant.updateMany({
      where: { platformAdminId: auth.session!.platformAdminId, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now }
    });
    const created = await tx.tenantAccessGrant.create({
      data: {
        platformAdminId: auth.session!.platformAdminId,
        tenantId: tenant.id,
        reason,
        ipAddress: requestIp(request),
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000)
      }
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: auth.session!.platformAdminId,
        tenantId: tenant.id,
        accessGrantId: created.id,
        action: "tenant_access_grant.created",
        requestMethod: request.method,
        requestPath: path,
        entityType: "TenantAccessGrant",
        entityId: created.id,
        ipAddress: requestIp(request),
        metadata: { tenantName: tenant.name, reasonLength: reason.length, expiresAt: created.expiresAt.toISOString() }
      }
    });
    return created;
  });

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/app/dashboard", process.env.APP_URL ?? request.url), 303);
  }
  return NextResponse.json({
    id: grant.id,
    tenantId: grant.tenantId,
    reason: grant.reason,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt
  }, { status: 201 });
}
