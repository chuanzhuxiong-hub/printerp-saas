import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/app/login", "/app/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminToken = request.cookies.get("printerp_admin_session")?.value;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!adminToken) return NextResponse.redirect(new URL("/admin/login", process.env.APP_URL ?? request.url));
    return NextResponse.next();
  }

  if (!pathname.startsWith("/app")) return NextResponse.next();
  if (publicPaths.includes(pathname)) return NextResponse.next();

  const token = request.cookies.get("printerp_session")?.value;
  if (!token) {
    if (adminToken) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-next-pathname", pathname);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.redirect(new URL("/app/login", process.env.APP_URL ?? request.url));
  }

  try {
    const secret = process.env.AUTH_SECRET ?? "";
    if (secret.length < 32) return NextResponse.redirect(new URL("/app/login", process.env.APP_URL ?? request.url));
    await jwtVerify(token, new TextEncoder().encode(secret));
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-next-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.redirect(new URL("/app/login", process.env.APP_URL ?? request.url));
  }
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"]
};
