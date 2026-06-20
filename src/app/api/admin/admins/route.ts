import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { platformAdminSuccessResponse, requirePlatformApiSuperAdminRequest } from "@/lib/platform-auth";
import { requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requirePlatformApiSuperAdminRequest(request);
  if (!auth.session) return auth.response;
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const role = String(form.get("role") ?? "ADMIN");
  if (role !== "ADMIN") return NextResponse.json({ error: "Only ADMIN can be created" }, { status: 403 });
  if (!email || !name || password.length < 12) {
    return NextResponse.json({ error: "Email, name and a password of at least 12 characters are required" }, { status: 400 });
  }
  if (await db.platformAdmin.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const path = new URL(request.url).pathname;
  try {
    const admin = await db.$transaction(async tx => {
      const created = await tx.platformAdmin.create({
        data: {
          email,
          name,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          createdByAdminId: auth.session.platformAdminId
        }
      });
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: auth.session.platformAdminId,
          action: "platform_admin.created",
          requestMethod: request.method,
          requestPath: path,
          ipAddress: requestIp(request),
          entityType: "PlatformAdmin",
          entityId: created.id,
          metadata: { email: created.email, role: created.role, status: created.status }
        }
      });
      return created;
    });
    return platformAdminSuccessResponse(request, { id: admin.id }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    throw error;
  }
}
