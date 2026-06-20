import { attachSessionToLogContext, createRequestLogContext } from "../src/lib/logger";
import { withApiLogging } from "../src/lib/http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const request = new Request("http://localhost:3000/api/orders/import?tab=test", {
    method: "POST",
    headers: { "x-request-id": "req-test-001" }
  });

  const context = createRequestLogContext(request, "orders.import");
  assert(context.requestId === "req-test-001", "request context should reuse inbound request id");
  assert(context.method === "POST", "request context should include method");
  assert(context.path === "/api/orders/import", "request context should include path without query string");
  assert(context.action === "orders.import", "request context should include action");

  attachSessionToLogContext(context, { tenantId: "tenant-1", userId: "user-1", role: "OWNER" });
  assert(context.tenantId === "tenant-1", "session enrichment should include tenant id");
  assert(context.userId === "user-1", "session enrichment should include user id");
  assert(context.role === "OWNER", "session enrichment should include role");

  const originalError = console.error;
  let loggedLine = "";
  console.error = (message?: unknown) => {
    loggedLine = String(message);
  };

  const failingHandler = withApiLogging("orders.import", async (_request, logContext) => {
    attachSessionToLogContext(logContext, { tenantId: "tenant-2", userId: "user-2", role: "MANAGER" });
    throw new Error("boom");
  });

  try {
    await failingHandler(new Request("http://localhost:3000/api/orders/import", { method: "POST" }));
    throw new Error("wrapped handler should rethrow failures");
  } catch (error) {
    assert(error instanceof Error && error.message === "boom", "wrapped handler should rethrow original error");
  } finally {
    console.error = originalError;
  }

  const parsed = JSON.parse(loggedLine);
  assert(parsed.level === "error", "log should be structured as error");
  assert(parsed.message === "api request failed", "log should use a stable message");
  assert(parsed.action === "orders.import", "log should include action");
  assert(parsed.path === "/api/orders/import", "log should include path");
  assert(parsed.method === "POST", "log should include method");
  assert(parsed.tenantId === "tenant-2", "log should include enriched tenant id");
  assert(parsed.userId === "user-2", "log should include enriched user id");
  assert(parsed.role === "MANAGER", "log should include enriched role");
  assert(parsed.requestId, "log should include request id");
  assert(parsed.error?.message === "boom", "log should include error message");

  const okHandler = withApiLogging("health.check", async () => new Response("ok"));
  const okResponse = await okHandler(new Request("http://localhost:3000/api/health", {
    headers: { "x-request-id": "req-ok-001" }
  }));
  assert(okResponse.headers.get("x-request-id") === "req-ok-001", "successful response should include request id header");

  const routeFiles = collectRouteFiles("src/app/api");
  const unwrappedMerchantPosts = routeFiles.filter(file => {
    const source = readFileSync(file, "utf8");
    return source.includes("requireApiSession")
      && source.includes("export async function POST")
      && !source.includes("withApiLogging")
      && !file.includes("\\admin\\")
      && !file.includes("/admin/");
  });
  assert(
    unwrappedMerchantPosts.length === 0,
    `merchant POST APIs must use withApiLogging: ${unwrappedMerchantPosts.join(", ")}`
  );

  console.log("API logging checks passed");
}

function collectRouteFiles(root: string): string[] {
  const entries = readdirSync(root);
  return entries.flatMap(entry => {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return collectRouteFiles(fullPath);
    return entry === "route.ts" ? [fullPath] : [];
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
