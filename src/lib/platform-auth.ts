import { createHash, randomBytes } from "node:crypto";
import type { PlatformAdminRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const PLATFORM_ADMIN_COOKIE_NAME = "printerp_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type PlatformAdminSession = {
  sessionId: string;
  platformAdminId: string;
  email: string;
  name: string;
  role: PlatformAdminRole;
};

export type MaintenanceContext = {
  actorType: "PLATFORM_ADMIN";
  userId: string;
  tenantId: string;
  tenantName: string;
  role: "OWNER";
  name: string;
  platformAdminId: string;
  accessGrantId: string;
  maintenanceReason: string;
  maintenanceExpiresAt: Date;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPlatformSession(platformAdminId: string, request: Request) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.platformAdminSession.create({
    data: {
      platformAdminId,
      tokenHash: tokenHash(token),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      expiresAt
    }
  });

  const store = await cookies();
  store.set(PLATFORM_ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/"
  });
}

export async function getPlatformSession(): Promise<PlatformAdminSession | null> {
  const store = await cookies();
  const token = store.get(PLATFORM_ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.platformAdminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: {
      id: true,
      platformAdminId: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      platformAdmin: { select: { email: true, name: true, role: true, status: true, updatedAt: true } }
    }
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.platformAdmin.status !== "ACTIVE" ||
    session.createdAt < session.platformAdmin.updatedAt
  ) {
    return null;
  }
  return {
    sessionId: session.id,
    platformAdminId: session.platformAdminId,
    email: session.platformAdmin.email,
    name: session.platformAdmin.name,
    role: session.platformAdmin.role
  };
}

export async function requirePlatformSession() {
  const session = await getPlatformSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function requirePlatformSuperAdmin() {
  const session = await requirePlatformSession();
  if (session.role !== "SUPER_ADMIN") redirect("/admin");
  return session;
}

export async function requirePlatformApiSuperAdmin() {
  const session = await getPlatformSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "SUPER_ADMIN") {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}

export async function requirePlatformApiSuperAdminRequest(request: Request) {
  const originCheck = validatePlatformWriteOrigin(request);
  if (originCheck) return { session: null, response: originCheck };
  return requirePlatformApiSuperAdmin();
}

export async function requirePlatformApiSessionRequest(request: Request) {
  const originCheck = validatePlatformWriteOrigin(request);
  if (originCheck) return { session: null, response: originCheck };
  const session = await getPlatformSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, response: null };
}

function validatePlatformWriteOrigin(request: Request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const expected = new URL(process.env.APP_URL ?? request.url).origin;
    if (origin && origin !== expected) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }
  return null;
}

export async function getMaintenanceContext(): Promise<{ context: MaintenanceContext | null; platformSession: PlatformAdminSession | null }> {
  const platformSession = await getPlatformSession();
  if (!platformSession) return { context: null, platformSession: null };
  const grant = await db.tenantAccessGrant.findFirst({
    where: {
      platformAdminId: platformSession.platformAdminId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      tenant: { deletedAt: null }
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tenantId: true,
      reason: true,
      expiresAt: true,
      tenant: { select: { name: true } }
    }
  });
  if (!grant) return { context: null, platformSession };
  return {
    platformSession,
    context: {
      actorType: "PLATFORM_ADMIN",
      userId: "",
      tenantId: grant.tenantId,
      tenantName: grant.tenant.name,
      role: "OWNER",
      name: platformSession.name,
      platformAdminId: platformSession.platformAdminId,
      accessGrantId: grant.id,
      maintenanceReason: grant.reason,
      maintenanceExpiresAt: grant.expiresAt
    }
  };
}

export function platformAdminSuccessResponse(request: Request, body: unknown, status = 200) {
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/admin/admins", process.env.APP_URL ?? request.url), 303);
  }
  return NextResponse.json(body, { status });
}

export async function revokeCurrentPlatformSession() {
  const store = await cookies();
  const token = store.get(PLATFORM_ADMIN_COOKIE_NAME)?.value;
  if (token) {
    await db.platformAdminSession.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  store.delete(PLATFORM_ADMIN_COOKIE_NAME);
}
