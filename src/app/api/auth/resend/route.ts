import { type NextRequest, NextResponse } from "next/server";

import { getIdentitySyncDatabase } from "../../../../infrastructure/database/runtime-connections";
import { createSupabaseRouteClient } from "../../../../infrastructure/supabase/route";
import {
  hasSameOrigin,
  readPublicJson,
  requestClientAddress,
} from "../../../../modules/identity-access/application/request-security";
import { checkAuthRateLimit } from "../../../../modules/identity-access/infrastructure/rate-limits";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const generic = {
    message: "If the account is eligible, a new verification message has been sent.",
  };
  if (!hasSameOrigin(request)) return NextResponse.json(generic, { status: 403 });
  const database = getIdentitySyncDatabase();
  const ipDecision = await checkAuthRateLimit(database, "verification_resend", [
    `ip:${requestClientAddress(request.headers)}`,
  ]);
  if (!ipDecision.allowed) {
    return NextResponse.json(generic, {
      headers: { "Retry-After": String(ipDecision.retryAfterSeconds) },
      status: 429,
    });
  }
  const parsed = await readPublicJson(request);
  if (!parsed.ok) return NextResponse.json(generic, { status: parsed.status });
  const input = parsed.value as { email?: unknown } | null;
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const decision = await checkAuthRateLimit(database, "verification_resend", [`account:${email}`]);
  if (!decision.allowed) {
    return NextResponse.json(generic, {
      headers: { "Retry-After": String(decision.retryAfterSeconds) },
      status: 429,
    });
  }
  if (email) {
    const supabase = createSupabaseRouteClient(request);
    await supabase.client.auth.resend({
      email,
      options: { emailRedirectTo: `${appUrl()}/auth/callback?next=/member` },
      type: "signup",
    });
    return supabase.applyTo(NextResponse.json(generic, { status: 202 }));
  }
  return NextResponse.json(generic, { status: 202 });
}
