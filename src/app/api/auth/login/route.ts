import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { homePathForRole } from "@/lib/permissions";
import { clearRateLimit, isRateLimited, rateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const loginKey = `login:${requestIp(request)}:${email || "unknown"}`;
  if (isRateLimited(loginKey, 10)) {
    return NextResponse.redirect(new URL("/app/login?error=rate-limit", process.env.APP_URL ?? request.url), 303);
  }
  const user = await db.user.findUnique({
    where: { email },
    include: { tenants: { where: { status: "ACTIVE" } } }
  });

  if (!user || !user.tenants[0] || !(await bcrypt.compare(password, user.passwordHash))) {
    rateLimit(loginKey, 10, 15 * 60 * 1000);
    return NextResponse.redirect(new URL("/app/login?error=invalid", process.env.APP_URL ?? request.url), 303);
  }

  clearRateLimit(loginKey);
  const rolePriority = ["OWNER", "MANAGER", "FINANCE", "PRODUCTION", "WAREHOUSE", "SUPPORT"];
  const membership = user.tenants.toSorted((a, b) => rolePriority.indexOf(a.role) - rolePriority.indexOf(b.role))[0];
  await createSession({
    userId: user.id,
    tenantId: membership.tenantId,
    role: membership.role,
    name: user.name
  });
  return NextResponse.redirect(new URL(homePathForRole(membership.role), process.env.APP_URL ?? request.url), 303);
}
