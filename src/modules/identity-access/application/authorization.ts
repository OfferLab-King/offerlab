import "server-only";

import { redirect } from "next/navigation";

import { getIdentitySyncDatabase } from "../../../infrastructure/database/runtime-connections";
import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
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
    if (
      linkError instanceof IdentityAccessError &&
      (linkError.code === "invalid_invitation" || linkError.code === "duplicate_identity")
    ) {
      return null;
    }
    throw linkError;
  }
}

export async function requireMember(): Promise<AuthorizationState> {
  const authUserId = await authenticatedUserId();
  if (!authUserId) redirect("/sign-in?next=/member");
  let authorization: AuthorizationState | null;
  try {
    authorization = await authorizationForIdentity(authUserId);
  } catch (authorizationError) {
    if (
      authorizationError instanceof IdentityAccessError &&
      authorizationError.code === "unverified_identity"
    ) {
      redirect("/verify-email");
    }
    throw authorizationError;
  }
  if (authorization?.entitlementStatus !== "active") {
    await captureAnalyticsEvent("beta_access_denied");
    redirect("/beta-access-denied");
  }
  return authorization;
}

async function authenticatedUserId(): Promise<string | null> {
  return getAuthenticatedSupabaseUserId();
}

export async function requireAdministrator(): Promise<AuthorizationState> {
  const authorization = await requireMember();
  if (authorization.role !== "administrator") redirect("/access-denied");
  return authorization;
}
