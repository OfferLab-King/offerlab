const ALLOWED_PATHS = [
  "/member",
  "/admin",
  "/reset-password/update",
  "/jobs",
  "/employers",
  "/intelligence",
  "/learn",
  "/plans",
] as const;

export function safeRedirectPath(value: string | null | undefined, fallback = "/member"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const url = new URL(value, "https://offerlab.invalid");
    if (url.origin !== "https://offerlab.invalid") return fallback;
    const allowed = ALLOWED_PATHS.some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    );
    return allowed ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
