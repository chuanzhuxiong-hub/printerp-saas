const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const email = "owner@demo.printerp.local";

async function login(password, forwardedFor) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "x-forwarded-for": forwardedFor },
    body: new URLSearchParams({ email, password }),
    redirect: "manual"
  });
}

const normalIp = `198.51.100.${Math.floor(Math.random() * 100) + 1}`;
for (let index = 0; index < 15; index++) {
  const response = await login("PrintERP123!", normalIp);
  if (response.status !== 303 || !response.headers.get("location")?.includes("/app/dashboard") || !response.headers.get("set-cookie")) {
    throw new Error(`Successful login was rate limited at attempt ${index + 1}`);
  }
}

const failureIp = `203.0.113.${Math.floor(Math.random() * 100) + 1}`;
for (let index = 0; index < 10; index++) {
  const response = await login("wrong-password", failureIp);
  if (response.status !== 303 || !response.headers.get("location")?.includes("error=invalid")) {
    throw new Error(`Invalid login response mismatch at attempt ${index + 1}`);
  }
}
const blocked = await login("PrintERP123!", failureIp);
if (blocked.status !== 303 || !blocked.headers.get("location")?.includes("error=rate-limit") || blocked.headers.get("set-cookie")) {
  throw new Error("Repeated invalid logins were not rate limited");
}

console.log("Login rate-limit passed: successful logins unaffected, repeated failures blocked");
