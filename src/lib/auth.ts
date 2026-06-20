import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getMaintenanceContext } from "@/lib/platform-auth";
import { authSecret } from "@/lib/runtime-config";

const COOKIE_NAME = "printerp_session";

export type Session = {
  actorType?: "TENANT_USER" | "PLATFORM_ADMIN";
  userId: string;
  tenantId: string;
  role: UserRole;
  name: string;
  platformAdminId?: string;
  accessGrantId?: string;
  tenantName?: string;
  maintenanceReason?: string;
  maintenanceExpiresAt?: Date;
};

type TenantSessionPayload = {
  userId: string;
  tenantId: string;
  role: UserRole;
  name: string;
};

export async function createSession(session: TenantSessionPayload) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(authSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret());
    const session = payload as Session;
    const membership = await db.tenantUser.findFirst({
      where: { tenantId: session.tenantId, userId: session.userId, status: "ACTIVE", user: { deletedAt: null }, tenant: { deletedAt: null } },
      select: { role: true, user: { select: { name: true } } }
    });
    if (!membership) return null;
    return { ...session, actorType: "TENANT_USER", role: membership.role, name: membership.user.name };
  } catch {
    return null;
  }
}

export async function getAppSession(): Promise<{ session: Session | null; hasValidPlatformSession: boolean }> {
  const maintenance = await getMaintenanceContext();
  if (maintenance.context) return { session: maintenance.context, hasValidPlatformSession: true };
  if (maintenance.platformSession) return { session: null, hasValidPlatformSession: true };
  return { session: await getSession(), hasValidPlatformSession: false };
}

export async function requireSession() {
  const { session, hasValidPlatformSession } = await getAppSession();
  if (!session) redirect(hasValidPlatformSession ? "/admin" : "/app/login");
  return session;
}
