import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth";
import { attachSessionToLogContext, createRequestLogContext, logError, RequestLogContext } from "@/lib/logger";
import { apiRoleRules, canAccessPath } from "@/lib/permissions";

export async function requireApiSession(request: Request, logContext?: RequestLogContext) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const expected = new URL(process.env.APP_URL ?? request.url).origin;
    if (origin && origin !== expected) {
      return { response: NextResponse.json({ error: "Invalid request origin" }, { status: 403 }), session: null };
    }
  }

  const { session, hasValidPlatformSession } = await getAppSession();
  if (!session) {
    if (hasValidPlatformSession) {
      return { response: NextResponse.json({ error: "No active maintenance grant" }, { status: 403 }), session: null };
    }
    return { response: NextResponse.redirect(new URL("/app/login", process.env.APP_URL ?? request.url), 303), session: null };
  }

  const pathname = new URL(request.url).pathname;
  if (!canAccessPath(pathname, session.role, apiRoleRules)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  attachSessionToLogContext(logContext, session);
  return { response: null, session };
}

export function withApiLogging<TArgs extends unknown[]>(
  action: string,
  handler: (request: Request, logContext: RequestLogContext, ...args: TArgs) => Promise<Response>
) {
  return async (request: Request, ...args: TArgs) => {
    const logContext = createRequestLogContext(request, action);
    try {
      const response = await handler(request, logContext, ...args);
      response.headers.set("x-request-id", logContext.requestId);
      return response;
    } catch (error) {
      logError("api request failed", error, logContext);
      throw error;
    }
  };
}

export function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function decimalText(form: FormData, key: string, fallback = "0") {
  const value = text(form, key);
  return value || fallback;
}
