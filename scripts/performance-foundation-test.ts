import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

const ordersPage = read("src/app/app/orders/page.tsx");
assert.match(ordersPage, /parsePagination/);
assert.match(ordersPage, /skip:\s*pagination\.skip/);
assert.match(ordersPage, /take:\s*pagination\.take/);
assert.doesNotMatch(ordersPage, /take:\s*100\s*[}),]/);
assert.match(ordersPage, /上一页/);
assert.match(ordersPage, /下一页/);

const productsPage = read("src/app/app/products/page.tsx");
assert.match(productsPage, /parsePagination/);
assert.match(productsPage, /_count:\s*\{\s*select:/);
assert.match(productsPage, /active === "competitors"/);
assert.match(productsPage, /active === "opportunities"/);
assert.doesNotMatch(productsPage, /include:\s*\{\s*skus:\s*\{/);
assert.doesNotMatch(productsPage, /snapshots:\s*\{\s*orderBy/);

const dashboard = read("src/lib/dashboard.ts");
assert.match(dashboard, /DASHBOARD_TTL_MS\s*=\s*60_000/);
assert.match(dashboard, /dashboardCache\.get/);
assert.match(dashboard, /dashboardCache\.set/);

const skuProfit = read("src/app/app/reports/sku-profit/page.tsx");
assert.match(skuProfit, /orderedAt:\s*\{\s*gte:\s*from\s*\}/);
assert.match(skuProfit, /select:\s*\{/);
assert.match(skuProfit, /take:\s*20000/);

const shopProfit = read("src/app/app/reports/shop-profit/page.tsx");
assert.match(shopProfit, /orderedAt:\s*\{\s*gte:\s*from\s*\}/);
assert.match(shopProfit, /select:\s*\{/);
assert.match(shopProfit, /take:\s*20000/);

const purchases = read("src/app/app/reports/purchases/page.tsx");
assert.match(purchases, /purchaseDate:\s*\{\s*gte:\s*from\s*\}/);
assert.match(purchases, /occurredAt:\s*\{\s*gte:\s*from\s*\}/);

console.log("Performance foundation checks passed: pagination, lazy product list, dashboard cache, report guardrails");
