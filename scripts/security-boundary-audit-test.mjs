import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const created = {};

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password }),
    redirect: "manual"
  });
  return {
    status: response.status,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? ""
  };
}

async function post(path, cookie, values) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { cookie },
    body: new URLSearchParams(values),
    redirect: "manual"
  });
}

try {
  const demoTenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
  const demoSku = await db.productSku.findFirstOrThrow({ where: { tenantId: demoTenant.id, deletedAt: null } });

  created.foreignTenant = await db.tenant.create({ data: { name: `Boundary victim ${stamp}`, slug: `boundary-victim-${stamp}` } });
  created.foreignShop = await db.shop.create({ data: { tenantId: created.foreignTenant.id, name: `Private shop ${stamp}` } });
  created.victimUser = await db.user.create({
    data: {
      email: `boundary-victim-${stamp}@test.local`,
      name: "Boundary victim",
      passwordHash: await bcrypt.hash("VictimPassword123!", 10),
      tenants: { create: { tenantId: created.foreignTenant.id, role: "OWNER" } }
    }
  });

  created.managerUser = await db.user.create({
    data: {
      email: `boundary-manager-${stamp}@test.local`,
      name: "Boundary manager",
      passwordHash: await bcrypt.hash("ManagerPassword123!", 10),
      tenants: { create: { tenantId: demoTenant.id, role: "MANAGER" } }
    }
  });
  const managerLogin = await login(created.managerUser.email, "ManagerPassword123!");
  assert.equal(managerLogin.status, 303);

  const takeoverPassword = "TakenOverPassword123!";
  const takeover = await post("/api/users", managerLogin.cookie, {
    email: created.victimUser.email,
    name: "Taken over",
    password: takeoverPassword,
    role: "OWNER"
  });
  const victimAfter = await db.user.findUniqueOrThrow({ where: { id: created.victimUser.id } });
  const attackerMembership = await db.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: demoTenant.id, userId: created.victimUser.id } }
  });
  const passwordWasReset = await bcrypt.compare(takeoverPassword, victimAfter.passwordHash);
  assert.equal(passwordWasReset, false, "Manager must not reset another user's global password");
  assert.equal(attackerMembership, null, "Manager must not grant OWNER membership");
  assert.equal(takeover.status, 403, "Manager OWNER assignment must return 403");

  const ownerLogin = await login("owner@demo.printerp.local", "PrintERP123!");
  assert.equal(ownerLogin.status, 303);
  const orderNo = `BOUNDARY-${stamp}`;
  const orderResponse = await post("/api/orders", ownerLogin.cookie, {
    orderNo,
    skuId: demoSku.id,
    shopId: created.foreignShop.id,
    quantity: "1",
    unitPrice: "10",
    receivedAmount: "10",
    productCost: "1"
  });
  created.order = await db.salesOrder.findFirst({ where: { tenantId: demoTenant.id, orderNo }, include: { shop: true } });
  assert.equal(created.order, null, "Order must not bind a shop from another tenant");
  assert.ok(orderResponse.status >= 400, "Cross-tenant shop assignment must fail");

  created.financeUser = await db.user.create({
    data: {
      email: `boundary-finance-${stamp}@test.local`,
      name: "Boundary finance",
      passwordHash: await bcrypt.hash("FinancePassword123!", 10),
      tenants: { create: { tenantId: demoTenant.id, role: "FINANCE" } }
    }
  });
  const financeLogin = await login(created.financeUser.email, "FinancePassword123!");
  assert.equal(financeLogin.status, 303);
  await db.tenantUser.update({
    where: { tenantId_userId: { tenantId: demoTenant.id, userId: created.financeUser.id } },
    data: { role: "SUPPORT" }
  });
  const stalePage = await fetch(`${baseUrl}/app/reports/profit`, {
    headers: { cookie: financeLogin.cookie },
    redirect: "manual"
  });
  assert.notEqual(stalePage.status, 200, "Downgraded employee must not render finance report");
  assert.ok(stalePage.headers.get("location")?.includes("/app/orders"), "Downgraded support employee must be redirected to an authorized home page");
  const supportHomePage = await fetch(`${baseUrl}/app/orders`, {
    headers: { cookie: financeLogin.cookie },
    redirect: "manual"
  });
  assert.equal(supportHomePage.status, 200, "Downgraded support employee must access the support home page");
  console.log("Security boundary regression passed: takeover, privilege escalation, relationship injection and stale-role access blocked");
} finally {
  if (created.order) {
    await db.costRecord.deleteMany({ where: { salesOrderId: created.order.id } });
    await db.auditLog.deleteMany({ where: { tenantId: created.order.tenantId, entityId: created.order.id } });
    await db.salesOrderItem.deleteMany({ where: { salesOrderId: created.order.id } });
    await db.salesOrder.deleteMany({ where: { id: created.order.id } });
  }
  if (created.managerUser || created.financeUser || created.victimUser) {
    const ids = [created.managerUser?.id, created.financeUser?.id, created.victimUser?.id].filter(Boolean);
    await db.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await db.tenantUser.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }
  if (created.foreignShop) await db.shop.deleteMany({ where: { id: created.foreignShop.id } });
  if (created.foreignTenant) await db.tenant.deleteMany({ where: { id: created.foreignTenant.id } });
  await db.$disconnect();
}
