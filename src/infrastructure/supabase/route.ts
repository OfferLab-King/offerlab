import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

type CookieToSet = Parameters<
  NonNullable<Parameters<typeof createServerClient>[2]["cookies"]["setAll"]>
>[0][number];

export function createSupabaseRouteClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Public Supabase configuration is required.");
  const pendingCookies: CookieToSet[] = [];
  const pendingHeaders = new Map<string, string>();
  const client = createServerClient(url, key, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        pendingCookies.push(...cookiesToSet);
        for (const [name, value] of Object.entries(headersToSet)) pendingHeaders.set(name, value);
      },
    },
  });
  return {
    applyTo(response: NextResponse): NextResponse {
      for (const cookie of pendingCookies) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
      for (const [name, value] of pendingHeaders) response.headers.set(name, value);
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    },
    clearLocalAuthCookies(response: NextResponse): NextResponse {
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-")) {
          response.cookies.set(cookie.name, "", {
            expires: new Date(0),
            httpOnly: true,
            maxAge: 0,
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      }
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    },
    client,
  };
}
