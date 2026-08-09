const localBypassMember = {
  authUserId: "10000000-0000-4000-8000-000000000003",
  userId: "20000000-0000-4000-8000-000000000003",
} as const;

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("127.")
  );
}

export function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isLoopbackRequestHost(value: string | null): boolean {
  if (!value) return false;
  try {
    return isLoopbackHostname(new URL(`http://${value}`).hostname);
  } catch {
    return false;
  }
}

export function isLocalAuthBypassEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return (
    environment.LOCAL_AUTH_BYPASS_ENABLED === "true" &&
    environment.APP_ENV === "local" &&
    environment.NODE_ENV === "development" &&
    isLoopbackUrl(environment.NEXT_PUBLIC_APP_URL)
  );
}

export const localAuthBypassMember = localBypassMember;
