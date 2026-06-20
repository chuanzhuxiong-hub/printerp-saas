const insecureSecrets = new Set([
  "development-only-secret-change-me",
  "replace-with-a-long-random-secret",
  "replace-with-at-least-32-random-characters"
]);

export function runtimeConfigIssues() {
  const issues: string[] = [];
  const secret = process.env.AUTH_SECRET ?? "";
  const appUrl = process.env.APP_URL ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (secret.length < 32 || insecureSecrets.has(secret)) issues.push("AUTH_SECRET 必须使用至少 32 位的随机密钥");
  if (!appUrl) issues.push("APP_URL 未配置");
  if (!databaseUrl) issues.push("DATABASE_URL 未配置");
  if (process.env.NODE_ENV === "production" && appUrl && !appUrl.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(appUrl)) {
    issues.push("生产环境 APP_URL 必须使用 HTTPS");
  }
  return issues;
}

export function authSecret() {
  const issues = runtimeConfigIssues().filter(issue => issue.startsWith("AUTH_SECRET"));
  if (issues.length) throw new Error(issues[0]);
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}
