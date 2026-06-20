import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`登录失败：${email}`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function counts(tenantId) {
  return Promise.all([
    db.salesOrder.count({ where: { tenantId } }),
    db.product.count({ where: { tenantId } }),
    db.tenantUser.count({ where: { tenantId } })
  ]);
}

const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-3d-print-studio" } });
const before = await counts(tenant.id);
const owner = await login("owner@demo.printerp.local", "PrintERP123!");
const warehouse = await login("warehouse@demo.printerp.local", "Warehouse123!");

const wrongConfirmation = await fetch(`${baseUrl}/api/data-management`, {
  method: "POST",
  headers: { cookie: owner },
  body: new URLSearchParams({ scope: "ALL", confirmation: "错误确认短语" }),
  redirect: "manual"
});
if (wrongConfirmation.status !== 303 || !wrongConfirmation.headers.get("location")?.includes("error=")) throw new Error("错误确认短语未被拦截");

const unauthorized = await fetch(`${baseUrl}/api/data-management`, {
  method: "POST",
  headers: { cookie: warehouse },
  body: new URLSearchParams({ scope: "ALL", confirmation: "初始化全部数据" }),
  redirect: "manual"
});
if (unauthorized.status !== 403) throw new Error("非老板账号未被拦截");

const after = await counts(tenant.id);
if (before.some((value, index) => value !== after[index])) throw new Error("安全拦截测试意外修改了业务数据");
await db.$disconnect();
console.log("Data management safety passed: wrong confirmation and non-owner blocked, live data unchanged");

