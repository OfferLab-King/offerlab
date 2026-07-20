import { type NextRequest, NextResponse } from "next/server";

import { captureAnalyticsEvent } from "../../../../infrastructure/analytics/capture";
import { logger } from "../../../../infrastructure/logging/logger";
import { createSupabaseRouteClient } from "../../../../infrastructure/supabase/route";
import {
  hasSameOrigin,
  readPublicJson,
} from "../../../../modules/identity-access/application/request-security";

const generic = { updated: false };

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const parsed = await readPublicJson(request);
  if (!parsed.ok) return NextResponse.json(generic, { status: parsed.status });
  const input = parsed.value as { password?: unknown } | null;
  if (typeof input?.password !== "string" || input.password.length < 10) {
    return NextResponse.json(generic, { status: 400 });
  }
  const supabase = createSupabaseRouteClient(request);
  const { data: authenticated, error: sessionError } = await supabase.client.auth.getClaims();
  if (sessionError || !authenticated?.claims.sub) {
    return supabase.applyTo(NextResponse.json(generic, { status: 401 }));
  }
  const { error } = await supabase.client.auth.updateUser({ password: input.password });
  if (error) return supabase.applyTo(NextResponse.json(generic, { status: 400 }));
  await captureAnalyticsEvent("password_recovery_completed");
  const { error: signOutError } = await supabase.client.auth.signOut();
  if (signOutError) {
    logger.error(
      { event: "password_update_logout_failed" },
      "Provider logout failed after password update",
    );
    return supabase.clearLocalAuthCookies(
      NextResponse.json({
        message:
          "Your password was changed, but we could not confirm that every session was signed out. Close this browser and sign in again with your new password.",
        signedOut: false,
        updated: true,
      }),
    );
  }
  return supabase.applyTo(NextResponse.json({ updated: true }));
}
