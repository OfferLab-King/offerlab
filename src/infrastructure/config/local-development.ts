const localBypassMember = {
  authUserId: "10000000-0000-4000-8000-000000000003",
  userId: "20000000-0000-4000-8000-000000000003",
} as const;

export type LocalAuthBypassRole = "member" | "administrator";

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

export function parseLocalAuthBypassArguments(arguments_: readonly string[]): LocalAuthBypassRole {
  if (arguments_.length === 0) return "member";
  if (arguments_.length === 1 && arguments_[0] === "--admin") return "administrator";
  throw new Error("Usage: local authentication bypass accepts only --admin");
}

export function localAuthBypassRole(
  environment: NodeJS.ProcessEnv = process.env,
): LocalAuthBypassRole {
  return environment.LOCAL_AUTH_BYPASS_ROLE === "administrator" ? "administrator" : "member";
}

export function localAuthBypassUserId(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.LOCAL_AUTH_BYPASS_USER_ID ?? localBypassMember.userId;
}

export const localAuthBypassMember = localBypassMember;
