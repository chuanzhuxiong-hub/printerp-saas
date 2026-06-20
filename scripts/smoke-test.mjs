const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

const health = await fetch(`${baseUrl}/api/health`);
if (health.status !== 200) throw new Error("健康检查不可用");

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password }),
    redirect: "manual"
  });
  if (response.status !== 303) throw new Error(`登录失败：${email} (${response.status})`);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function get(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: "manual" });
  return { status: response.status, location: response.headers.get("location"), body: await response.text() };
}

const owner = await login("owner@demo.printerp.local", "PrintERP123!");
const routes = [
  "/app/dashboard",
  "/app/orders",
  "/app/orders/import",
  "/app/cost-imports",
  "/app/gcode",
  "/app/printer-maintenance",
  "/app/printer-parts",
  "/app/printer-parts/new",
  "/app/printer-parts/purchase",
  "/app/printer-parts/replace",
  "/app/tool-assets",
  "/app/tool-assets/new",
  "/app/expenses",
  "/app/exports",
  "/app/help",
  "/app/shipments",
  "/app/production",
  "/app/inventory",
  "/app/inventory/replenishment",
  "/app/inventory/slow-moving",
  "/app/inventory/scan",
  "/app/purchases/batches",
  "/app/purchases/new",
  "/app/purchases/packaging/new",
  "/app/inventory/adjustments/new",
  "/app/reports/sku-profit",
  "/app/reports/purchases",
  "/app/reports/sku-trends",
  "/app/reports/supplier-costs",
  "/app/reports/after-sales-reasons",
  "/app/settings/users",
  "/app/settings/materials",
  "/app/settings/packaging",
  "/app/settings/printers",
  "/app/settings/data"
];

for (const route of routes) {
  const response = await get(route, owner);
  if (response.status !== 200) throw new Error(`${route} 返回 ${response.status}`);
}

const orders = await get("/app/orders", owner);
const purchaseForm = await get("/app/purchases/new", owner);
const packagingPurchaseForm = await get("/app/purchases/packaging/new", owner);
if (!purchaseForm.body.includes("入库重量") || !purchaseForm.body.includes("千克（kg）") || !purchaseForm.body.includes('value="KG" selected') || !purchaseForm.body.includes('name="purchaseDate"')) {
  throw new Error("耗材采购重量单位、默认 kg 或采购日期未生效");
}
if (!packagingPurchaseForm.body.includes('name="purchaseDate"')) throw new Error("包装采购日期未生效");
const help = await get("/app/help", owner);
if (!help.body.includes("使用帮助中心") || !help.body.includes("销售订单") || !help.body.includes("库存总览")) {
  throw new Error("使用帮助中心内容不完整");
}
const helpSearch = await get("/app/help?q=%E5%BA%93%E5%AD%98", owner);
if (!helpSearch.body.includes("库存总览") || !helpSearch.body.includes("扫码出入库")) throw new Error("使用帮助搜索不可用");
const orderImport = await get("/app/orders/import", owner);
if (!orderImport.body.includes("PINDUODUO") || !orderImport.body.includes("SHOPIFY") || !orderImport.body.includes("ETSY")) {
  throw new Error("平台订单导入选项不可用");
}
const costImport = await get("/app/cost-imports", owner);
if (!costImport.body.includes("SHIPPING") || !costImport.body.includes("ADVERTISING")) throw new Error("费用账单导入不可用");
const purchaseReport = await get("/app/reports/purchases", owner);
if (!purchaseReport.body.includes("采购金额分析") || !purchaseReport.body.includes("按日排列") || !purchaseReport.body.includes("按周排列") || !purchaseReport.body.includes("按月排列") || !purchaseReport.body.includes("按年排列") || !purchaseReport.body.includes("打印机配件")) {
  throw new Error("采购金额分析的时间维度或采购分类不完整");
}
const gcode = await get("/app/gcode", owner);
if (!gcode.body.includes("BOM") || !gcode.body.includes("PRODUCTION")) throw new Error("G-code 解析页面不可用");
const orderIds = [...orders.body.matchAll(/\/app\/orders\/([^"/]+)"/g)].map(match => match[1]).filter(id => id.startsWith("c"));
const orderId = orderIds[0];
if (!orderId) throw new Error("订单列表没有可访问的订单详情");
const detail = await get(`/app/orders/${orderId}`, owner);
if (detail.status !== 200 || !detail.body.includes("成本追溯")) throw new Error("订单详情追溯信息不可用");

const products = await get("/app/products", owner);
for (const tab of ["ai", "competitors", "opportunities"]) {
  const productTab = await get(`/app/products?tab=${tab}`, owner);
  if (productTab.status !== 200) throw new Error(`产品中心 ${tab} Tab 不可用`);
}
const productId = [...products.body.matchAll(/\/app\/products\/([^"/]+)"/g)].map(match => match[1]).find(id => id.startsWith("c"));
if (!productId) throw new Error("产品中心没有产品详情入口");
const productDetail = await get(`/app/products/${productId}`, owner);
if (productDetail.status !== 200 || !productDetail.body.includes("电商内容") || !productDetail.body.includes("竞品监控")) throw new Error("产品详情增长工作台不可用");

for (const [listPath, detailPattern, expected] of [
  ["/app/purchases", /\/app\/purchases\/(c[^"/]+)/, "采购明细"],
  ["/app/production", /\/app\/production\/(c[^"/]+)/, "库存流水"],
  ["/app/shipments", /\/app\/shipments\/(c[^"/]+)/, "出库明细"]
]) {
  const list = await get(listPath, owner);
  const id = list.body.match(detailPattern)?.[1];
  if (!id) throw new Error(`${listPath} 没有详情入口`);
  const detailPage = await get(`${listPath}/${id}`, owner);
  if (detailPage.status !== 200 || !detailPage.body.includes(expected)) throw new Error(`${listPath} 详情页不可用`);
  if (listPath === "/app/purchases") {
    if (!detailPage.body.includes("编辑采购单") || !detailPage.body.includes("撤销采购单")) throw new Error("采购单编辑撤销入口不可用");
    const editPage = await get(`${listPath}/${id}/edit`, owner);
    if (editPage.status !== 200 || !editPage.body.includes("编辑采购单")) throw new Error("采购单编辑页面不可用");
  }
}

const warehouse = await login("warehouse@demo.printerp.local", "Warehouse123!");
const warehouseInventory = await get("/app/inventory", warehouse);
const warehouseReports = await get("/app/reports/profit", warehouse);
const warehouseHelp = await get("/app/help", warehouse);
if (warehouseInventory.status !== 200) throw new Error("仓库员无法访问库存");
if (warehouseReports.status !== 307 || !warehouseReports.location?.includes("/app/inventory")) throw new Error("仓库员财务报表权限未生效");
if (warehouseHelp.status !== 200 || !warehouseHelp.body.includes("库存总览") || warehouseHelp.body.includes("利润报表")) throw new Error("帮助中心角色过滤未生效");
const warehouseDataManagement = await get("/app/settings/data", warehouse);
if (warehouseDataManagement.status !== 307 || !warehouseDataManagement.location?.includes("/app/inventory")) throw new Error("数据初始化老板专属权限未生效");

console.log(`PrintERP smoke test passed: ${routes.length + 16} checks`);
