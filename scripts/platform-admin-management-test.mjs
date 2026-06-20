import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const id = randomUUID();
const password = "PlatformAdminTest123!";
const newPassword = "PlatformAdminChanged456!";
const createdIds = [];
let tenant;
let merchant;
let forbiddenSuperEmail;

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function login(email, submittedPassword) {
  return fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password: submittedPassword }),
    redirect: "manual"
  });
}

async function request(path, cookie, data, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie, ...headers },
    body: new URLSearchParams(data),
    redirect: "manual"
  });
}

function runInitializer(args) {
  return spawnSync(process.execPath, ["scripts/create-super-admin.mjs", ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8"
  });
}

function runInitializerAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/create-super-admin.mjs", ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("close", status => resolve({ status, stdout, stderr }));
  });
}

async function createSessionAndGrant(platformAdminId) {
  await db.platformAdminSession.create({
    data: {
      platformAdminId,
      tokenHash: randomUUID().replaceAll("-", ""),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  await db.tenantAccessGrant.create({
    data: {
      platformAdminId,
      tenantId: tenant.id,
      reason: "Task 3 management test",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }
  });
}

try {
  const superEmail = `super-${id}@test.local`;
  const secondSuperEmail = `second-super-${id}@test.local`;
  forbiddenSuperEmail = `forbidden-super-${id}@test.local`;
  const adminEmail = `admin-${id}@test.local`;
  const createdEmail = `created-${id}@test.local`;
  tenant = await db.tenant.create({ data: { name: `Admin test ${id}`, slug: `admin-test-${id}` } });
  merchant = await db.user.create({
    data: {
      email: createdEmail,
      name: "Existing merchant",
      passwordHash: await bcrypt.hash("ExistingMerchant123!", 12),
      tenants: { create: { tenantId: tenant.id, role: "OWNER" } }
    }
  });

  const concurrentA = `concurrent-a-${id}@test.local`;
  const concurrentB = `concurrent-b-${id}@test.local`;
  const concurrentResults = await Promise.all([
    runInitializerAsync(["--email", concurrentA, "--name", "Concurrent A", "--password", password]),
    runInitializerAsync(["--email", concurrentB, "--name", "Concurrent B", "--password", password])
  ]);
  const successes = concurrentResults.filter(result => result.status === 0);
  assert.equal(successes.length, 1, "Concurrent first SUPER_ADMIN initialization must allow exactly one success");
  const concurrentAdmins = await db.platformAdmin.findMany({ where: { email: { in: [concurrentA, concurrentB] } } });
  assert.equal(concurrentAdmins.length, 1, "Concurrent first SUPER_ADMIN initialization must create exactly one SUPER_ADMIN");
  createdIds.push(...concurrentAdmins.map(admin => admin.id));
  await db.platformAdmin.deleteMany({ where: { id: { in: createdIds } } });
  createdIds.length = 0;

  const initialize = runInitializer([
    "--email", ` ${superEmail.toUpperCase()} `,
    "--name", "Initial Super Admin",
    "--password", password
  ]);
  assert.equal(initialize.status, 0, `Super admin initializer must succeed: ${initialize.stderr}`);
  const superAdmin = await db.platformAdmin.findUniqueOrThrow({ where: { email: superEmail } });
  createdIds.push(superAdmin.id);
  assert.equal(superAdmin.role, "SUPER_ADMIN");
  assert.equal(superAdmin.status, "ACTIVE");
  assert.ok(await bcrypt.compare(password, superAdmin.passwordHash), "Initializer must use the submitted password");
  assert.equal(await db.tenantUser.count({ where: { user: { email: superEmail } } }), 0, "Initializer must not create TenantUser");

  await createSessionAndGrant(superAdmin.id);
  const resetSuper = runInitializer([
    "--email", superEmail,
    "--name", "Reset Super Admin",
    "--password", newPassword
  ]);
  assert.equal(resetSuper.status, 0, `Initializer must reset the existing SUPER_ADMIN: ${resetSuper.stderr}`);
  const resetSuperAdmin = await db.platformAdmin.findUniqueOrThrow({ where: { id: superAdmin.id } });
  assert.equal(resetSuperAdmin.name, "Reset Super Admin", "Initializer must update the existing SUPER_ADMIN name");
  assert.equal(resetSuperAdmin.status, "ACTIVE", "Initializer must activate the existing SUPER_ADMIN");
  assert.ok(await bcrypt.compare(newPassword, resetSuperAdmin.passwordHash), "Initializer must reset the existing SUPER_ADMIN password");
  assert.equal(await db.platformAdminSession.count({ where: { platformAdminId: superAdmin.id, revokedAt: null } }), 0, "Initializer reset must revoke sessions");
  assert.equal(await db.tenantAccessGrant.count({ where: { platformAdminId: superAdmin.id, revokedAt: null } }), 0, "Initializer reset must revoke grants");
  const resetBack = runInitializer([
    "--email", superEmail,
    "--name", "Initial Super Admin",
    "--password", password
  ]);
  assert.equal(resetBack.status, 0, "Initializer must allow resetting the same SUPER_ADMIN back for later login tests");

  const forbiddenSecondSuper = runInitializer([
    "--email", forbiddenSuperEmail,
    "--name", "Forbidden second super",
    "--password", password
  ]);
  assert.notEqual(forbiddenSecondSuper.status, 0, "Initializer must only create the first SUPER_ADMIN");
  assert.equal(await db.platformAdmin.count({ where: { email: forbiddenSuperEmail } }), 0, "Initializer must not create a different SUPER_ADMIN when one exists");

  const secondSuperAdmin = await db.platformAdmin.create({
    data: {
      email: secondSuperEmail,
      name: "Second super admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPER_ADMIN"
    }
  });
  createdIds.push(secondSuperAdmin.id);

  const directAdmin = await db.platformAdmin.create({
    data: {
      email: adminEmail,
      name: "Ordinary admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
      createdByAdminId: superAdmin.id
    }
  });
  createdIds.push(directAdmin.id);
  const forbiddenPromotion = runInitializer([
    "--email", adminEmail,
    "--name", "Promoted",
    "--password", newPassword
  ]);
  assert.notEqual(forbiddenPromotion.status, 0, "Initializer must not promote an existing ADMIN");
  assert.equal((await db.platformAdmin.findUniqueOrThrow({ where: { id: directAdmin.id } })).role, "ADMIN");

  const superCookie = cookieFrom(await login(superEmail, password));
  const adminCookie = cookieFrom(await login(adminEmail, password));
  assert.ok(superCookie && adminCookie, "Both administrators must log in for permission tests");
  const superPage = await fetch(`${baseUrl}/admin/admins`, { headers: { cookie: superCookie }, redirect: "manual" });
  assert.equal(superPage.status, 200, "SUPER_ADMIN must access administrator management page");
  const adminPage = await fetch(`${baseUrl}/admin/admins`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(adminPage.status, 307, "ADMIN must not access administrator management page");

  for (const [path, data] of [
    ["/api/admin/admins", { email: `unauthorized-${id}@test.local`, name: "Unauthorized", password }],
    [`/api/admin/admins/${directAdmin.id}`, { intent: "disable" }]
  ]) {
    const response = await request(path, "", data);
    assert.equal(response.status, 401, `Unauthenticated request must receive 401 for ${path}`);
  }

  const csrfCreate = await request("/api/admin/admins", superCookie, {
    email: `csrf-${id}@test.local`,
    name: "CSRF",
    password
  }, { origin: "https://evil.example" });
  assert.equal(csrfCreate.status, 403, "Cross-origin platform admin creation must be blocked");

  const csrfManage = await request(`/api/admin/admins/${directAdmin.id}`, superCookie, { intent: "disable" }, { origin: "https://evil.example" });
  assert.equal(csrfManage.status, 403, "Cross-origin platform admin management must be blocked");

  for (const [path, data] of [
    ["/api/admin/admins", { email: `blocked-${id}@test.local`, name: "Blocked", password }],
    [`/api/admin/admins/${superAdmin.id}`, { intent: "disable" }],
    [`/api/admin/admins/${directAdmin.id}`, { intent: "enable" }],
    [`/api/admin/admins/${superAdmin.id}`, { intent: "reset-password", password: newPassword }]
  ]) {
    const response = await request(path, adminCookie, data);
    assert.equal(response.status, 403, `ADMIN must receive 403 for ${path}`);
  }

  const createSuper = await request("/api/admin/admins", superCookie, {
    email: `other-super-${id}@test.local`,
    name: "Other super",
    password,
    role: "SUPER_ADMIN"
  });
  assert.equal(createSuper.status, 403, "API must not create SUPER_ADMIN");

  const create = await request("/api/admin/admins", superCookie, {
    email: ` ${createdEmail.toUpperCase()} `,
    name: "Created admin",
    password,
    role: "ADMIN"
  });
  assert.equal(create.status, 201, "SUPER_ADMIN must create ADMIN");
  const createdAdmin = await db.platformAdmin.findUniqueOrThrow({ where: { email: createdEmail } });
  createdIds.push(createdAdmin.id);
  assert.equal(createdAdmin.role, "ADMIN");
  assert.equal(createdAdmin.createdByAdminId, superAdmin.id);
  assert.ok(await bcrypt.compare(password, createdAdmin.passwordHash), "Created ADMIN password must be hashed and usable");
  assert.equal(await db.tenantUser.count({ where: { userId: merchant.id } }), 1, "Creating ADMIN must not alter existing merchant membership");
  assert.ok(await bcrypt.compare("ExistingMerchant123!", (await db.user.findUniqueOrThrow({ where: { id: merchant.id } })).passwordHash), "Creating ADMIN must not alter merchant password");

  const duplicateCreate = await request("/api/admin/admins", superCookie, {
    email: createdEmail,
    name: "Duplicate admin",
    password,
    role: "ADMIN"
  });
  assert.equal(duplicateCreate.status, 409, "Duplicate ADMIN creation must return 409 instead of a server error");

  const browserCreatedEmail = `browser-${id}@test.local`;
  const browserCreate = await request("/api/admin/admins", superCookie, {
    email: browserCreatedEmail,
    name: "Browser created admin",
    password,
    role: "ADMIN"
  }, { accept: "text/html" });
  const browserCreatedAdmin = await db.platformAdmin.findUniqueOrThrow({ where: { email: browserCreatedEmail } });
  createdIds.push(browserCreatedAdmin.id);
  assert.equal(browserCreate.status, 303, "Browser create form must redirect to administrator management");
  assert.match(browserCreate.headers.get("location") ?? "", /\/admin\/admins$/);

  const manageSuper = await request(`/api/admin/admins/${superAdmin.id}`, superCookie, { intent: "disable" });
  assert.equal(manageSuper.status, 403, "SUPER_ADMIN must not manage a SUPER_ADMIN");
  const manageSelf = await request(`/api/admin/admins/${superAdmin.id}`, superCookie, { intent: "reset-password", password: newPassword });
  assert.equal(manageSelf.status, 403, "SUPER_ADMIN must not manage self");
  const disableOtherSuper = await request(`/api/admin/admins/${secondSuperAdmin.id}`, superCookie, { intent: "disable" });
  assert.equal(disableOtherSuper.status, 403, "SUPER_ADMIN must not disable another SUPER_ADMIN");
  const resetOtherSuper = await request(`/api/admin/admins/${secondSuperAdmin.id}`, superCookie, { intent: "reset-password", password: newPassword });
  assert.equal(resetOtherSuper.status, 403, "SUPER_ADMIN must not reset another SUPER_ADMIN password");

  await createSessionAndGrant(createdAdmin.id);
  const disable = await request(`/api/admin/admins/${createdAdmin.id}`, superCookie, { intent: "disable" });
  assert.equal(disable.status, 200, "SUPER_ADMIN must disable ADMIN");
  assert.equal((await db.platformAdmin.findUniqueOrThrow({ where: { id: createdAdmin.id } })).status, "DISABLED");
  assert.equal(await db.platformAdminSession.count({ where: { platformAdminId: createdAdmin.id, revokedAt: null } }), 0, "Disable must revoke sessions");
  assert.equal(await db.tenantAccessGrant.count({ where: { platformAdminId: createdAdmin.id, revokedAt: null } }), 0, "Disable must revoke grants");

  const enable = await request(`/api/admin/admins/${createdAdmin.id}`, superCookie, { intent: "enable" }, { accept: "text/html" });
  assert.equal(enable.status, 303, "Browser enable form must redirect to administrator management");
  assert.match(enable.headers.get("location") ?? "", /\/admin\/admins$/);
  assert.equal((await db.platformAdmin.findUniqueOrThrow({ where: { id: createdAdmin.id } })).status, "ACTIVE");

  await createSessionAndGrant(createdAdmin.id);
  const reset = await request(`/api/admin/admins/${createdAdmin.id}`, superCookie, { intent: "reset-password", password: newPassword });
  assert.equal(reset.status, 200, "SUPER_ADMIN must reset ADMIN password");
  assert.equal(await db.platformAdminSession.count({ where: { platformAdminId: createdAdmin.id, revokedAt: null } }), 0, "Password reset must revoke sessions");
  assert.equal(await db.tenantAccessGrant.count({ where: { platformAdminId: createdAdmin.id, revokedAt: null } }), 0, "Password reset must revoke grants");
  assert.equal(cookieFrom(await login(createdEmail, password)), "", "Old password must no longer log in");
  assert.ok(cookieFrom(await login(createdEmail, newPassword)), "New password must log in");

  const logs = await db.platformAuditLog.findMany({ where: { entityType: "PlatformAdmin", entityId: createdAdmin.id } });
  assert.deepEqual(new Set(logs.map(log => log.action)), new Set([
    "platform_admin.created",
    "platform_admin.disabled",
    "platform_admin.enabled",
    "platform_admin.password_reset"
  ]), "Every management write must create a platform audit log");
  for (const log of logs) {
    assert.equal(log.platformAdminId, superAdmin.id);
    assert.equal(log.requestMethod, "POST");
    assert.ok(log.requestPath?.startsWith("/api/admin/admins"));
    const serialized = JSON.stringify(log.metadata ?? {}).toLowerCase();
    for (const sensitive of ["password", "hash", "token", "cookie", password.toLowerCase(), newPassword.toLowerCase()]) {
      assert.ok(!serialized.includes(sensitive), `Audit metadata must not contain ${sensitive}`);
    }
  }

  console.log("Platform admin management passed");
} finally {
  if (createdIds.length) {
    await db.platformAuditLog.deleteMany({ where: { platformAdminId: { in: createdIds } } });
    await db.tenantAccessGrant.deleteMany({ where: { platformAdminId: { in: createdIds } } });
    await db.platformAdminSession.deleteMany({ where: { platformAdminId: { in: createdIds } } });
    await db.platformAdmin.deleteMany({ where: { id: { in: createdIds } } });
  }
  if (forbiddenSuperEmail) await db.platformAdmin.deleteMany({ where: { email: forbiddenSuperEmail } });
  if (merchant) {
    await db.tenantUser.deleteMany({ where: { userId: merchant.id } });
    await db.user.deleteMany({ where: { id: merchant.id } });
  }
  if (tenant) await db.tenant.deleteMany({ where: { id: tenant.id } });
  await db.$disconnect();
}
