import { type NextRequest, NextResponse } from "next/server";

import { captureAnalyticsEvent } from "../../../../infrastructure/analytics/capture";
import { getIdentitySyncDatabase } from "../../../../infrastructure/database/runtime-connections";
import { createSupabaseRouteClient } from "../../../../infrastructure/supabase/route";
import { linkVerifiedIdentity } from "../../../../modules/identity-access/infrastructure/identity-linking";
import { checkAuthRateLimit } from "../../../../modules/identity-access/infrastructure/rate-limits";
import {
  hasSameOrigin,
  readPublicJson,
  requestClientAddress,
} from "../../../../modules/identity-access/application/request-security";

const genericError = "We could not complete that request. Check your details and try again.";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasSameOrigin(request)) return NextResponse.json({ message: genericError }, { status: 403 });
  const database = getIdentitySyncDatabase();
  const ipDecision = await checkAuthRateLimit(database, "registration", [
    `ip:${requestClientAddress(request.headers)}`,
  ]);
  if (!ipDecision.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Please wait and try again." },
      { headers: { "Retry-After": String(ipDecision.retryAfterSeconds) }, status: 429 },
    );
  }
  const parsed = await readPublicJson(request);
  if (!parsed.ok) {
    return NextResponse.json({ message: genericError }, { status: parsed.status });
  }
  const input = parsed.value as {
    email?: unknown;
    password?: unknown;
  } | null;
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input?.password === "string" ? input.password : "";
  if (!email || password.length < 10) {
    return NextResponse.json({ message: genericError }, { status: 400 });
  }

  const decision = await checkAuthRateLimit(database, "registration", [`account:${email}`]);
  if (!decision.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Please wait and try again." },
      { headers: { "Retry-After": String(decision.retryAfterSeconds) }, status: 429 },
    );
  }

  try {
    const supabase = createSupabaseRouteClient(request);
    const { data: existing } = await supabase.client.auth.getUser();
    if (existing.user?.email_confirmed_at) {
      if (existing.user.email?.trim().toLowerCase() !== email) throw new Error("identity mismatch");
      await linkVerifiedIdentity(database, existing.user.id);
      await captureAnalyticsEvent("identity_linked");
      return supabase.applyTo(NextResponse.json({ next: "/member" }));
    }

    const { data, error } = await supabase.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${appUrl()}/auth/callback?next=/member` },
    });
    if (error || !data.user) throw new Error("signup failed");
    if (data.session || data.user.email_confirmed_at) {
      await linkVerifiedIdentity(database, data.user.id);
      await captureAnalyticsEvent("identity_linked");
      await captureAnalyticsEvent("registration_completed");
      return supabase.applyTo(NextResponse.json({ next: "/member" }));
    }
    await captureAnalyticsEvent("registration_completed");
    return supabase.applyTo(NextResponse.json({ next: "/verify-email?registered=1" }));
  } catch {
    return NextResponse.json({ message: genericError }, { status: 400 });
  }
}
