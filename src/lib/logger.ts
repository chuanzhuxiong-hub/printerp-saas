export type LogContext = Record<string, unknown>;

export type RequestLogContext = {
  requestId: string;
  action: string;
  method: string;
  path: string;
  tenantId?: string;
  userId?: string;
  role?: string;
} & LogContext;

type SessionLike = {
  tenantId?: string | null;
  userId?: string | null;
  role?: string | null;
};

function fallbackRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error) };
}

export function logError(message: string, error: unknown, context: LogContext = {}) {
  console.error(JSON.stringify({
    level: "error",
    message,
    error: normalizeError(error),
    ...context,
    timestamp: new Date().toISOString()
  }));
}

export function createRequestLogContext(request: Request, action: string): RequestLogContext {
  const url = new URL(request.url);
  return {
    requestId: request.headers.get("x-request-id") || fallbackRequestId(),
    action,
    method: request.method,
    path: url.pathname
  };
}

export function attachSessionToLogContext(context: RequestLogContext | null | undefined, session: SessionLike | null | undefined) {
  if (!context) return context;
  if (!session) return context;
  if (session.tenantId) context.tenantId = session.tenantId;
  if (session.userId) context.userId = session.userId;
  if (session.role) context.role = session.role;
  return context;
}
