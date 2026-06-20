import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["audit", "--json", "--omit=dev"], { encoding: "utf8", shell: false });
const report = JSON.parse(result.stdout || "{}");
const counts = report.metadata?.vulnerabilities ?? {};
if ((counts.critical ?? 0) > 0 || (counts.high ?? 0) > 0) {
  throw new Error(`Dependency audit failed: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high`);
}
console.log(`Dependency security gate passed: 0 critical, 0 high, ${counts.moderate ?? 0} moderate tracked upstream`);
