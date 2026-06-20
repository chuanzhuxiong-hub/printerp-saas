const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const totalRequests = Number(process.env.PERF_REQUESTS ?? 120);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 12);
const p95LimitMs = Number(process.env.PERF_P95_LIMIT_MS ?? 2000);

const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", body: new URLSearchParams({ email: "owner@demo.printerp.local", password: "PrintERP123!" }), redirect: "manual" });
if (login.status !== 303) throw new Error(`Performance test login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
const durations = [];
let failures = 0;
let next = 0;

async function worker() {
  while (next < totalRequests) {
    const index = next++;
    const path = index % 3 === 0 ? "/api/health" : index % 3 === 1 ? "/app/dashboard" : "/app/products";
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${path}`, { headers: path.startsWith("/app") ? { cookie } : undefined });
    durations.push(performance.now() - startedAt);
    if (response.status !== 200) failures++;
    await response.arrayBuffer();
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((a, b) => a - b);
const percentile = value => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)];
const p50 = percentile(0.5);
const p95 = percentile(0.95);
const max = durations.at(-1);
if (failures) throw new Error(`Performance test had ${failures} failed requests`);
if (p95 > p95LimitMs) throw new Error(`Performance p95 ${p95.toFixed(1)}ms exceeds ${p95LimitMs}ms`);
console.log(`Performance passed: ${totalRequests} requests, concurrency ${concurrency}, p50 ${p50.toFixed(1)}ms, p95 ${p95.toFixed(1)}ms, max ${max.toFixed(1)}ms`);
