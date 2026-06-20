import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runtimeConfigIssues } from "@/lib/runtime-config";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const issues = runtimeConfigIssues();
    return NextResponse.json({ status: issues.length ? "degraded" : "ok", database: "ok", configuration: issues.length ? "invalid" : "ok", issues, timestamp: new Date().toISOString() }, { status: issues.length ? 503 : 200 });
  } catch {
    return NextResponse.json({ status: "degraded", database: "error", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
