import { NextResponse } from "next/server";

import { logger } from "../../../../infrastructure/logging/logger";
import { currentMemberAccess } from "../../../../modules/identity-access/application/authorization";
import {
  readOnboardingProfile,
  updateOnboardingProfile,
} from "../../../../modules/member-profile/application/onboarding";
import { readOnboardingJson } from "../../../../modules/member-profile/application/request";
import { hasSameOrigin } from "../../../../modules/identity-access/application/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const generic = { message: "We could not complete that request. Please try again." };

function accessError(status: "denied" | "unauthenticated" | "unverified"): NextResponse {
  const code = status === "unauthenticated" ? 401 : 403;
  return NextResponse.json(generic, { status: code });
}

export async function GET(): Promise<NextResponse> {
  const access = await currentMemberAccess();
  if (access.status !== "eligible") return accessError(access.status);
  const profile = await readOnboardingProfile(access.authorization.userId);
  return NextResponse.json({ profile });
}

export async function PUT(request: Request): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const parsed = await readOnboardingJson(request);
  if (!parsed.ok) return NextResponse.json(generic, { status: parsed.status });
  const access = await currentMemberAccess();
  if (access.status !== "eligible") return accessError(access.status);

  try {
    const result = await updateOnboardingProfile(access.authorization.userId, parsed.value);
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    return NextResponse.json({
      completed: Boolean(result.profile.completedAt),
      ok: true,
      outcome: result.outcome,
    });
  } catch (error) {
    logger.error({ err: error, event: "onboarding_save_failed" }, "Onboarding profile save failed");
    return NextResponse.json(generic, { status: 500 });
  }
}
