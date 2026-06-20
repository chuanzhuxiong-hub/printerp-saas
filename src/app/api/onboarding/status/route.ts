import { NextResponse } from "next/server";
import { requireApiSession, withApiLogging } from "@/lib/http";
import { RequestLogContext } from "@/lib/logger";
import { getOnboardingStatus } from "@/lib/onboarding";

async function handleGet(request: Request, logContext: RequestLogContext) {
  const auth = await requireApiSession(request, logContext);
  if (auth.response) return auth.response;
  const data = await getOnboardingStatus(auth.session.tenantId);
  return NextResponse.json(data);
}

export const GET = withApiLogging("onboarding.status", handleGet);
