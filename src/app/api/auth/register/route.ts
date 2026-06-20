import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, requestIp } from "@/lib/rate-limit";

function slugify(value: string) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tenant"}-${Date.now()}`;
}

export async function POST(request: Request) {
  if (!rateLimit(`register:${requestIp(request)}`, 5, 60 * 60 * 1000).allowed) {
    return NextResponse.redirect(new URL("/app/register?error=rate-limit", process.env.APP_URL ?? request.url), 303);
  }
  const form = await request.formData();
  const tenantName = String(form.get("tenantName") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");

  if (!tenantName || !name || !email || password.length < 8) {
    return NextResponse.redirect(new URL("/app/register?error=invalid", process.env.APP_URL ?? request.url), 303);
  }
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.redirect(new URL("/app/register?error=duplicate", process.env.APP_URL ?? request.url), 303);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    const tenant = await tx.tenant.create({ data: { name: tenantName, slug: slugify(tenantName), contactName: name } });
    await tx.tenantUser.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    await tx.auditLog.create({
      data: { tenantId: tenant.id, userId: user.id, action: "tenant.registered", entityType: "Tenant", entityId: tenant.id }
    });
    return { user, tenant };
  });

  await createSession({ userId: result.user.id, tenantId: result.tenant.id, role: "OWNER", name: result.user.name });
  return NextResponse.redirect(new URL("/app/dashboard", process.env.APP_URL ?? request.url), 303);
}
