import { type NextRequest, NextResponse } from "next/server";

import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import { createSupabaseRouteClient } from "../../../infrastructure/supabase/route";
import { hasSameOrigin } from "../../../modules/identity-access/application/request-security";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ message: "We could not complete that request." }, { status: 403 });
  }
  const supabase = createSupabaseRouteClient(request);
  await supabase.client.auth.signOut();
  await captureAnalyticsEvent("sign_out_completed");
  return supabase.applyTo(
    NextResponse.redirect(
      new URL("/sign-in?signed-out=1", process.env.NEXT_PUBLIC_APP_URL ?? request.url),
      303,
    ),
  );
}
