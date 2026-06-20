import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPlatformSession } from "@/lib/platform-auth";
import { clearRateLimit, isRateLimited, rateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const loginKey = `admin-login:${requestIp(request)}:${email || "unknown"}`;
  if (isRateLimited(loginKey, 10)) {
    return NextResponse.redirect(new URL("/admin/login?error=rate-limit", process.env.APP_URL ?? request.url), 303);
  }

  const admin = await db.platformAdmin.findUnique({ where: { email } });
  if (!admin || admin.status !== "ACTIVE" || !(await bcrypt.compare(password, admin.passwordHash))) {
    rateLimit(loginKey, 10, 15 * 60 * 1000);
    return NextResponse.redirect(new URL("/admin/login?error=invalid", process.env.APP_URL ?? request.url), 303);
  }

  clearRateLimit(loginKey);
  await db.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await createPlatformSession(admin.id, request);
  return NextResponse.redirect(new URL("/admin", process.env.APP_URL ?? request.url), 303);
}
