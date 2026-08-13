import "server-only";

import { redirect } from "next/navigation";

import { getIdentitySyncDatabase } from "../../../infrastructure/database/runtime-connections";
import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import {
  isLocalAuthBypassEnabled,
  isLoopbackClientAddress,
  isLoopbackRequestHost,
  localAuthBypassClientAddressHeader,
  localAuthBypassCookieName,
  localAuthBypassRole,
  localAuthBypassUserId,
} from "../../../infrastructure/config/local-development";
import { headers } from "next/headers";
import { requestClientAddress } from "./request-security";
import { checkAuthRateLimit } from "../infrastructure/rate-limits";
import { getAuthenticatedSupabaseUserId } from "../../../infrastructure/supabase/authenticated-user";
import { IdentityAccessError } from "./errors";
import {
  linkVerifiedIdentity,
  readAuthorizationForIdentity,
  type AuthorizationState,
} from "../infrastructure/identity-linking";

export async function currentAuthorization(): Promise<AuthorizationState | null> {
  const localAuthorization = await localDevelopmentAuthorization();
  if (localAuthorization) return localAuthorization;
  const authUserId = await authenticatedUserId();
  if (!authUserId) return null;
  try {
    return await authorizationForIdentity(authUserId);
  } catch (authorizationError) {
    if (
      authorizationError instanceof IdentityAccessError &&
      authorizationError.code === "unverified_identity"
    ) {
      redirect("/verify-email");
    }
    throw authorizationError;
  }
}

export type MemberAccessDecision =
  | Readonly<{ authorization: AuthorizationState; status: "eligible" }>
  | Readonly<{ status: "denied" | "unauthenticated" | "unverified" }>;

export async function currentMemberAccess(): Promise<MemberAccessDecision> {
  const localAuthorization = await localDevelopmentAuthorization();
  if (localAuthorization) return { authorization: localAuthorization, status: "eligible" };
  const authUserId = await authenticatedUserId();
  if (!authUserId) return { status: "unauthenticated" };
  try {
    const authorization = await authorizationForIdentity(authUserId);
    if (authorization?.entitlementStatus !== "active") return { status: "denied" };
    return { authorization, status: "eligible" };
  } catch (authorizationError) {
    if (
      authorizationError instanceof IdentityAccessError &&
      authorizationError.code === "unverified_identity"
    ) {
      return { status: "unverified" };
    }
    throw authorizationError;
  }
}

async function authorizationForIdentity(authUserId: string): Promise<AuthorizationState | null> {
  const database = getIdentitySyncDatabase();
  const existing = await readAuthorizationForIdentity(database, authUserId);
  if (existing) return existing;

  try {
    const requestHeaders = await headers();
    const decision = await checkAuthRateLimit(database, "identity_link", [
      `ip:${requestClientAddress(requestHeaders)}`,
      `identity:${authUserId}`,
    ]);
    if (!decision.allowed) return null;
    const linked = await linkVerifiedIdentity(database, authUserId);
    await captureAnalyticsEvent("identity_linked");
    return linked;
  } catch (linkError) {
    if (linkError instanceof IdentityAccessError && linkError.code === "duplicate_identity") {
      return null;
    }
    throw linkError;
  }
}

export async function requireMember(): Promise<AuthorizationState> {
  const decision = await currentMemberAccess();
  if (decision.status === "eligible") return decision.authorization;
  if (decision.status === "unauthenticated") redirect("/sign-in?next=/member");
  if (decision.status === "unverified") redirect("/verify-email");
  await captureAnalyticsEvent("beta_access_denied");
  redirect("/beta-access-denied");
}

async function authenticatedUserId(): Promise<string | null> {
  return getAuthenticatedSupabaseUserId();
}

async function localDevelopmentAuthorization(): Promise<AuthorizationState | null> {
  if (!isLocalAuthBypassEnabled()) return null;
  const requestHeaders = await headers();
  if (!isLoopbackRequestHost(requestHeaders.get("host"))) return null;
  const requestSecret = process.env.LOCAL_AUTH_BYPASS_REQUEST_SECRET;
  if (
    !requestSecret ||
    requestCookie(requestHeaders, localAuthBypassCookieName) !== requestSecret
  ) {
    return null;
  }
  const clientAddress = requestHeaders.get(localAuthBypassClientAddressHeader);
  if (!clientAddress || !isLoopbackClientAddress(clientAddress)) return null;
  return {
    entitlementStatus: "active",
    role: localAuthBypassRole(),
    userId: localAuthBypassUserId(),
  };
}

function requestCookie(requestHeaders: Headers, name: string): string | undefined {
  for (const segment of requestHeaders.get("cookie")?.split(";") ?? []) {
    const separator = segment.indexOf("=");
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function requireAdministrator(): Promise<AuthorizationState> {
  const authorization = await requireMember();
  if (authorization.role !== "administrator") redirect("/access-denied");
  return authorization;
}
