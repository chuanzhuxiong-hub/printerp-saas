import { NextResponse } from "next/server";
import { revokeCurrentPlatformSession } from "@/lib/platform-auth";

export async function POST(request: Request) {
  await revokeCurrentPlatformSession();
  return NextResponse.redirect(new URL("/admin/login", process.env.APP_URL ?? request.url), 303);
}
