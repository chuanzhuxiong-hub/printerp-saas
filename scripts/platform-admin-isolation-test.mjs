import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const id = randomUUID();
const password = "PlatformAdminTest123!";
let admin;
let tenant;
let user;

async function login(path, email, submittedPassword) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: new URLSearchParams({ email, password: submittedPassword }),
    redirect: "manual"
  });
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

function setCookieFrom(response) {
  return response.headers.get("set-cookie") ?? "";
}

try {
  tenant = await db.tenant.create({ data: { name: `Isolation ${id}`, slug: `isolation-${id}` } });
  user = await db.user.create({
    data: {
      email: `merchant-${id}@test.local`,
      name: "Merchant isolation test",
      passwordHash: await bcrypt.hash(password, 10),
      tenants: { create: { tenantId: tenant.id, role: "OWNER" } }
    }
  });
  admin = await db.platformAdmin.create({
    data: {
      email: `admin-${id}@test.local`,
      name: "Platform isolation test",
      passwordHash: await bcrypt.hash(password, 10),
      role: "SUPER_ADMIN"
    }
  });

  const merchantLogin = await login("/api/auth/login", user.email, password);
  const merchantCookie = cookieFrom(merchantLogin);
  assert.match(merchantCookie, /^printerp_session=/, "Merchant login must set the merchant cookie");
  const merchantToAdmin = await fetch(`${baseUrl}/admin`, { headers: { cookie: merchantCookie }, redirect: "manual" });
  assert.equal(merchantToAdmin.status, 307, "Merchant cookie must not access /admin");
  assert.match(merchantToAdmin.headers.get("location") ?? "", /\/admin\/login/, "Merchant must be redirected to admin login");
  const merchantWithForgedAdminCookie = await fetch(`${baseUrl}/app/dashboard`, {
    headers: { cookie: `${merchantCookie}; printerp_admin_session=forged-${id}` },
    redirect: "manual"
  });
  assert.equal(merchantWithForgedAdminCookie.status, 200, "A forged platform cookie must not lock out a valid merchant session");

  const invalidLogin = await login("/api/admin/auth/login", admin.email, "wrong-password");
  assert.equal(invalidLogin.status, 303, "Invalid platform login must redirect");
  assert.match(invalidLogin.headers.get("location") ?? "", /\/admin\/login\?error=invalid/, "Invalid platform login must report invalid");
  assert.equal(cookieFrom(invalidLogin), "", "Invalid platform login must not set a cookie");

  const activeLogin = await login("/api/admin/auth/login", admin.email, password);
  assert.equal(activeLogin.status, 303, "Active platform administrator must be able to log in");
  assert.match(activeLogin.headers.get("location") ?? "", /\/admin$/, "Platform login must redirect to /admin");
  const activeSetCookie = setCookieFrom(activeLogin);
  const adminCookie = cookieFrom(activeLogin);
  assert.match(adminCookie, /^printerp_admin_session=/, "Platform login must set only the platform cookie");
  assert.ok(!adminCookie.startsWith("printerp_session="), "Platform login must not set the merchant cookie");
  assert.match(activeSetCookie, /^printerp_admin_session=/, "Platform login Set-Cookie must use the platform cookie name");
  assert.match(activeSetCookie, /;\s*HttpOnly/i, "Platform login cookie must be HttpOnly");
  assert.match(activeSetCookie, /;\s*SameSite=Lax/i, "Platform login cookie must use SameSite=Lax");
  assert.match(activeSetCookie, /;\s*Path=\//i, "Platform login cookie must use Path=/");
  assert.match(activeSetCookie, /;\s*Max-Age=\d+/i, "Platform login cookie must define Max-Age");
  assert.ok(!activeSetCookie.includes("printerp_session="), "Platform login must not set the merchant cookie");

  const storedSession = await db.platformAdminSession.findFirstOrThrow({ where: { platformAdminId: admin.id } });
  assert.ok(storedSession.tokenHash, "Platform session must store a token hash");
  assert.ok(!adminCookie.includes(storedSession.tokenHash), "Raw platform cookie must not contain the stored token hash");
  const loggedInAdmin = await db.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
  assert.ok(loggedInAdmin.lastLoginAt, "Successful login must update lastLoginAt");

  const adminHome = await fetch(`${baseUrl}/admin`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(adminHome.status, 200, "Active platform session must access /admin");
  const adminToApp = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(adminToApp.status, 307, "Platform cookie must not access /app without a maintenance grant");
  assert.match(adminToApp.headers.get("location") ?? "", /\/admin$/, "Platform cookie must be redirected to /admin");
  const merchantAndAdminToApp = await fetch(`${baseUrl}/app/dashboard`, {
    headers: { cookie: `${merchantCookie}; ${adminCookie}` },
    redirect: "manual"
  });
  assert.equal(merchantAndAdminToApp.status, 307, "A valid platform identity must take priority over a valid merchant identity");
  assert.match(merchantAndAdminToApp.headers.get("location") ?? "", /\/admin$/, "Dual valid identities must redirect to /admin");

  await db.platformAdminSession.update({ where: { id: storedSession.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  const expiredSession = await fetch(`${baseUrl}/admin`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(expiredSession.status, 307, "An expired platform database session must be rejected");
  assert.match(expiredSession.headers.get("location") ?? "", /\/admin\/login/, "Expired platform session must redirect to admin login");
  const merchantWithExpiredAdminCookie = await fetch(`${baseUrl}/app/dashboard`, {
    headers: { cookie: `${merchantCookie}; ${adminCookie}` },
    redirect: "manual"
  });
  assert.equal(merchantWithExpiredAdminCookie.status, 200, "An expired platform cookie must not lock out a valid merchant session");

  const disableTargetLogin = await login("/api/admin/auth/login", admin.email, password);
  const disableTargetCookie = cookieFrom(disableTargetLogin);
  await db.platformAdmin.update({ where: { id: admin.id }, data: { status: "DISABLED" } });
  const disabledSession = await fetch(`${baseUrl}/admin`, { headers: { cookie: disableTargetCookie }, redirect: "manual" });
  assert.equal(disabledSession.status, 307, "Disabling an administrator must invalidate an existing session immediately");
  assert.match(disabledSession.headers.get("location") ?? "", /\/admin\/login/, "Disabled session must redirect to admin login");

  const disabledLogin = await login("/api/admin/auth/login", admin.email, password);
  assert.equal(disabledLogin.status, 303, "Disabled platform login must redirect");
  assert.match(disabledLogin.headers.get("location") ?? "", /\/admin\/login\?error=invalid/, "Disabled platform administrator must not log in");
  assert.equal(cookieFrom(disabledLogin), "", "Disabled platform login must not set a cookie");

  await db.platformAdmin.update({ where: { id: admin.id }, data: { status: "ACTIVE" } });
  const reactivatedOldSession = await fetch(`${baseUrl}/admin`, { headers: { cookie: disableTargetCookie }, redirect: "manual" });
  assert.equal(reactivatedOldSession.status, 307, "Re-enabling an administrator must not restore a session created before disablement");
  assert.match(reactivatedOldSession.headers.get("location") ?? "", /\/admin\/login/, "A stale re-enabled session must redirect to admin login");

  const secondLogin = await login("/api/admin/auth/login", admin.email, password);
  const secondCookie = cookieFrom(secondLogin);
  const logout = await fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: "POST",
    headers: { cookie: secondCookie },
    redirect: "manual"
  });
  assert.equal(logout.status, 303, "Platform logout must redirect");
  assert.match(logout.headers.get("location") ?? "", /\/admin\/login/, "Platform logout must redirect to admin login");
  const logoutSetCookie = setCookieFrom(logout);
  assert.match(logoutSetCookie, /^printerp_admin_session=/, "Platform logout must clear the platform cookie");
  assert.match(logoutSetCookie, /;\s*Path=\//i, "Platform logout must clear the cookie at Path=/");
  assert.match(logoutSetCookie, /;\s*(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i, "Platform logout must expire the platform cookie");
  const revokedSession = await fetch(`${baseUrl}/admin`, { headers: { cookie: secondCookie }, redirect: "manual" });
  assert.equal(revokedSession.status, 307, "Logout must revoke the current database session");

  console.log("Platform admin isolation passed");
} finally {
  if (admin) {
    await db.platformAdminSession.deleteMany({ where: { platformAdminId: admin.id } });
    await db.platformAdmin.deleteMany({ where: { id: admin.id } });
  }
  if (user) {
    await db.tenantUser.deleteMany({ where: { userId: user.id } });
    await db.user.deleteMany({ where: { id: user.id } });
  }
  if (tenant) await db.tenant.deleteMany({ where: { id: tenant.id } });
  await db.$disconnect();
}
