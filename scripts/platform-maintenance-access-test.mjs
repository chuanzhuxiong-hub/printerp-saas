import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const id = randomUUID();
const password = "PlatformMaintenance123!";
let platformAdmin;
let tenantA;
let tenantB;
let merchant;
let skuA;
let skuB;

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function platformLogin() {
  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: platformAdmin.email, password }),
    redirect: "manual"
  });
  assert.equal(response.status, 303, "Platform admin login must redirect on success");
  const cookie = cookieFrom(response);
  assert.ok(cookie.includes("printerp_admin_session="), "Platform login must set the platform cookie");
  return cookie;
}

async function merchantLogin() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email: merchant.email, password }),
    redirect: "manual"
  });
  assert.equal(response.status, 303, "Merchant login must redirect on success");
  const cookie = cookieFrom(response);
  assert.ok(cookie.includes("printerp_session="), "Merchant login must set the merchant cookie");
  return cookie;
}

async function post(path, cookie, data, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie, ...headers },
    body: new URLSearchParams(data),
    redirect: "manual"
  });
}

async function createOrder(cookie, sku, orderNo) {
  return post("/api/orders", cookie, {
    orderNo,
    skuId: sku.id,
    quantity: "1",
    unitPrice: "9.90",
    receivedAmount: "9.90"
  });
}

try {
  tenantA = await db.tenant.create({ data: { name: `Maintenance tenant A ${id}`, slug: `maintenance-a-${id}` } });
  tenantB = await db.tenant.create({ data: { name: `Maintenance tenant B ${id}`, slug: `maintenance-b-${id}` } });
  platformAdmin = await db.platformAdmin.create({
    data: {
      email: `maintenance-admin-${id}@test.local`,
      name: "Maintenance Admin",
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN"
    }
  });
  merchant = await db.user.create({
    data: {
      email: `maintenance-merchant-${id}@test.local`,
      name: "Maintenance Merchant",
      passwordHash: await bcrypt.hash(password, 12),
      tenants: { create: { tenantId: tenantB.id, role: "OWNER" } }
    }
  });
  const productA = await db.product.create({ data: { tenantId: tenantA.id, name: "Maintained product A" } });
  const productB = await db.product.create({ data: { tenantId: tenantB.id, name: "Maintained product B" } });
  skuA = await db.productSku.create({ data: { tenantId: tenantA.id, productId: productA.id, skuCode: `MA-${id}`, name: "Maintained SKU A", salePrice: "9.90" } });
  skuB = await db.productSku.create({ data: { tenantId: tenantB.id, productId: productB.id, skuCode: `MB-${id}`, name: "Maintained SKU B", salePrice: "19.90" } });

  const adminCookie = await platformLogin();
  const merchantCookie = await merchantLogin();

  const emptyReason = await post("/api/admin/grants", adminCookie, { tenantId: tenantA.id, reason: "   " });
  assert.equal(emptyReason.status, 400, "Grant creation must reject empty reason");

  const csrf = await post("/api/admin/grants", adminCookie, { tenantId: tenantA.id, reason: "CSRF" }, { origin: "https://evil.example" });
  assert.equal(csrf.status, 403, "Grant creation must block malicious Origin");

  const withoutGrant = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(withoutGrant.status, 307, "Platform admin without grant must not enter merchant app");
  assert.match(withoutGrant.headers.get("location") ?? "", /\/admin$/);

  const grantResponse = await post("/api/admin/grants", adminCookie, { tenantId: tenantA.id, reason: "Investigate customer issue" });
  assert.equal(grantResponse.status, 201, "Platform admin must create a maintenance grant");
  const firstGrant = await grantResponse.json();
  assert.equal(firstGrant.tenantId, tenantA.id);
  assert.equal(firstGrant.reason, "Investigate customer issue");
  const createdAt = new Date(firstGrant.createdAt).getTime();
  const expiresAt = new Date(firstGrant.expiresAt).getTime();
  assert.ok(expiresAt - createdAt >= 29 * 60 * 1000 && expiresAt - createdAt <= 31 * 60 * 1000, "Grant must expire in about 30 minutes");

  const dashboard = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(dashboard.status, 200, "Valid maintenance grant must enter target merchant dashboard as OWNER");

  const ownerOnlyPage = await fetch(`${baseUrl}/app/settings/data`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(ownerOnlyPage.status, 200, "Maintenance context must pass OWNER-only page rules");

  const createdOrder = await createOrder(adminCookie, skuA, `MAINT-${id}`);
  assert.equal(createdOrder.status, 303, "Maintenance context must pass merchant API role rules");
  const order = await db.salesOrder.findFirstOrThrow({ where: { tenantId: tenantA.id, orderNo: `MAINT-${id}` } });
  assert.notEqual(order.createdBy, platformAdmin.id, "Maintenance API writes must not impersonate platform admin as a tenant user");

  const crossTenantOrder = await createOrder(adminCookie, skuB, `CROSS-${id}`);
  assert.notEqual(crossTenantOrder.status, 303, "Maintenance grant must not access another tenant's SKU/API data");
  assert.equal(await db.salesOrder.count({ where: { tenantId: tenantB.id, orderNo: `CROSS-${id}` } }), 0, "Cross-tenant maintenance write must not create data");

  const secondGrantResponse = await post("/api/admin/grants", adminCookie, { tenantId: tenantB.id, reason: "Switch tenant maintenance" });
  assert.equal(secondGrantResponse.status, 201, "Creating a new grant must succeed");
  assert.equal(await db.tenantAccessGrant.count({ where: { platformAdminId: platformAdmin.id, revokedAt: null, expiresAt: { gt: new Date() } } }), 1, "Only one active grant per platform admin is allowed");
  const firstGrantAfterSwitch = await db.tenantAccessGrant.findUniqueOrThrow({ where: { id: firstGrant.id } });
  assert.ok(firstGrantAfterSwitch.revokedAt, "Creating a new grant must revoke the previous active grant");

  const revokedOldTenant = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(revokedOldTenant.status, 200, "New active grant should still allow app access for the new tenant");
  assert.equal(await db.salesOrder.count({ where: { tenantId: tenantA.id, orderNo: `MAINT-${id}` } }), 1);

  const activeGrant = await db.tenantAccessGrant.findFirstOrThrow({ where: { platformAdminId: platformAdmin.id, revokedAt: null } });
  const revokeOther = await post(`/api/admin/grants/${firstGrant.id}/revoke`, adminCookie, {});
  assert.equal(revokeOther.status, 404, "Platform admin must not revoke an already revoked/non-active grant as current access");
  const revoke = await post(`/api/admin/grants/${activeGrant.id}/revoke`, adminCookie, {});
  assert.equal(revoke.status, 200, "Platform admin must revoke own active grant");
  const afterRevoke = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(afterRevoke.status, 307, "Revoked grant must immediately lose app access");

  const expired = await db.tenantAccessGrant.create({
    data: {
      platformAdminId: platformAdmin.id,
      tenantId: tenantA.id,
      reason: "Expired maintenance",
      expiresAt: new Date(Date.now() - 1000)
    }
  });
  const afterExpired = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(afterExpired.status, 307, "Expired grant must not allow app access");
  await db.tenantAccessGrant.update({ where: { id: expired.id }, data: { revokedAt: new Date() } });

  const fakePlatformCookie = `${merchantCookie}; printerp_admin_session=fake-${id}`;
  const merchantWithFakePlatform = await fetch(`${baseUrl}/app/dashboard`, { headers: { cookie: fakePlatformCookie }, redirect: "manual" });
  assert.equal(merchantWithFakePlatform.status, 200, "Forged platform cookie must not lock out a valid merchant session");

  const historicalPage = await fetch(`${baseUrl}/admin/grants`, { headers: { cookie: adminCookie }, redirect: "manual" });
  assert.equal(historicalPage.status, 200, "Platform admin must view own maintenance grant history");

  console.log("Platform maintenance access passed");
} finally {
  if (platformAdmin) {
    await db.platformAuditLog.deleteMany({ where: { platformAdminId: platformAdmin.id } });
    await db.tenantAccessGrant.deleteMany({ where: { platformAdminId: platformAdmin.id } });
    await db.platformAdminSession.deleteMany({ where: { platformAdminId: platformAdmin.id } });
    await db.platformAdmin.deleteMany({ where: { id: platformAdmin.id } });
  }
  if (tenantA || tenantB) {
    await db.auditLog.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
    await db.costRecord.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
    await db.salesOrderItem.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
    await db.salesOrder.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
    await db.productSku.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
    await db.product.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } });
  }
  if (merchant) {
    await db.tenantUser.deleteMany({ where: { userId: merchant.id } });
    await db.user.deleteMany({ where: { id: merchant.id } });
  }
  if (tenantA) await db.tenant.deleteMany({ where: { id: tenantA.id } });
  if (tenantB) await db.tenant.deleteMany({ where: { id: tenantB.id } });
  await db.$disconnect();
}
