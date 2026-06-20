import { readFile } from "node:fs/promises";

const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const health = await fetch(`${baseUrl}/api/health`);
const healthBody = await health.json();
if (health.status !== 200 || healthBody.status !== "ok" || healthBody.configuration !== "ok") throw new Error(`Runtime readiness failed: ${JSON.stringify(healthBody)}`);
for (const [header, expected] of [["x-content-type-options", "nosniff"], ["x-frame-options", "DENY"]]) {
  if (health.headers.get(header) !== expected) throw new Error(`Missing security header ${header}`);
}

const prodCompose = await readFile("docker-compose.prod.yml", "utf8");
const postgresBlock = prodCompose.match(/\n  postgres:\n([\s\S]*?)(?=\n  [a-zA-Z][\w-]*:\n|\nvolumes:)/)?.[1] ?? "";
if (postgresBlock.includes("\n    ports:")) throw new Error("Production PostgreSQL must not expose host ports");
if (!prodCompose.includes("127.0.0.1:${APP_PORT:-3000}:3000")) throw new Error("Production app must bind to localhost for reverse proxy use");
if (!prodCompose.includes("${AUTH_SECRET:?AUTH_SECRET is required}")) throw new Error("Production AUTH_SECRET must be required");
if (!prodCompose.includes("prisma\", \"migrate\", \"deploy")) throw new Error("Production migrations are not automated");
if (!prodCompose.includes("http://127.0.0.1:3000/api/health")) throw new Error("Production healthcheck is missing or not IPv4-safe");
if (!prodCompose.includes("no-new-privileges:true") || !prodCompose.includes("cap_drop:")) throw new Error("Production container hardening is missing");
if (!prodCompose.includes('max-size: "10m"')) throw new Error("Production log rotation is missing");

const dockerfile = await readFile("Dockerfile", "utf8");
if (!dockerfile.includes("USER printerp")) throw new Error("Application container must run as non-root");
console.log("Commercial readiness passed: runtime configuration, security headers, production isolation, migrations and healthcheck");
