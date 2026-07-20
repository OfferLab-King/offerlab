import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function applyPrivateSecurityHeaders(response: NextResponse, pathname: string): void {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Vary", "Cookie");
  response.headers.set("Vercel-CDN-Cache-Control", "private, no-store");

  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")
  ) {
    const supabaseOrigin = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
      } catch {
        return "";
      }
    })();
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        `connect-src 'self' ${supabaseOrigin}`.trim(),
        "form-action 'self'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "object-src 'none'",
        `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
      ].join("; "),
    );
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      auth: { flowType: "pkce" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headersToSet) => {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
          }
          response = NextResponse.next({ request });
          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
          for (const [name, value] of Object.entries(headersToSet)) {
            response.headers.set(name, value);
          }
        },
      },
    });
    await supabase.auth.getClaims();
  }

  applyPrivateSecurityHeaders(response, request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/auth/:path*",
    "/auth/:path*",
    "/member/:path*",
    "/register/:path*",
    "/reset-password/:path*",
    "/sign-in/:path*",
    "/verify-email/:path*",
  ],
};
