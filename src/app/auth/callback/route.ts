import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import { getIdentitySyncDatabase } from "../../../infrastructure/database/runtime-connections";
import { requestClientAddress } from "../../../modules/identity-access/application/request-security";
import { safeRedirectPath } from "../../../modules/identity-access/domain/redirect";
import { linkVerifiedIdentity } from "../../../modules/identity-access/infrastructure/identity-linking";
import { checkAuthRateLimit } from "../../../modules/identity-access/infrastructure/rate-limits";

const callbackError = "/sign-in?error=Unable%20to%20verify%20that%20link.";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.url;
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const recovery = next === "/reset-password/update" || type === "recovery";
  const response = NextResponse.redirect(
    new URL(recovery ? "/reset-password/update" : "/sign-in?verified=1", appUrl),
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Public Supabase configuration is required.");
  const supabase = createServerClient(url, key, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
        for (const [name, value] of Object.entries(headersToSet)) {
          response.headers.set(name, value);
        }
      },
    },
  });
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "email" || type === "recovery")
      ? await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === "recovery" ? "recovery" : "email",
        })
      : { data: { user: null }, error: new Error("missing callback credential") };

  if (error || !data.user) return NextResponse.redirect(new URL(callbackError, appUrl));
  if (data.session) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }
  if (recovery) return response;

  const database = getIdentitySyncDatabase();
  const decision = await checkAuthRateLimit(database, "identity_link", [
    `ip:${requestClientAddress(request.headers)}`,
    `identity:${data.user.id}`,
  ]);
  if (!decision.allowed) {
    return NextResponse.redirect(
      new URL("/sign-in?error=Too%20many%20attempts.%20Please%20wait.", appUrl),
    );
  }

  try {
    await linkVerifiedIdentity(database, data.user.id);
    await captureAnalyticsEvent("email_verified");
    await captureAnalyticsEvent("identity_linked");
    return response;
  } catch {
    return NextResponse.redirect(new URL(callbackError, appUrl));
  }
}
