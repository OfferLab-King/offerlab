import type { Sql } from "postgres";

import { IdentityAccessError } from "../application/errors";
import { withIdentitySyncRole } from "./identity-sync-database";

export type AuthorizationState = Readonly<{
  entitlementStatus: "active" | "revoked" | null;
  role: "administrator" | "member";
  userId: string;
}>;

type AuthorizationRow = Readonly<{
  entitlement_status: "active" | "revoked" | null;
  role: string;
  user_id: string;
}>;

function authorizationState(row: AuthorizationRow): AuthorizationState {
  return {
    entitlementStatus: row.entitlement_status,
    role: row.role === "administrator" ? "administrator" : "member",
    userId: row.user_id,
  };
}

function translateIdentityError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("offerlab_unverified_identity")) {
    throw new IdentityAccessError(
      "unverified_identity",
      "Authentication identity is not verified.",
    );
  }
  if (message.includes("offerlab_duplicate_identity")) {
    throw new IdentityAccessError("duplicate_identity", "Identity is already linked.");
  }
  throw error;
}

export async function linkVerifiedIdentity(
  database: Sql,
  authUserId: string,
): Promise<AuthorizationState> {
  try {
    const rows = await withIdentitySyncRole(
      database,
      (transaction) =>
        transaction<
          AuthorizationRow[]
        >`select * from app.link_open_member_identity(${authUserId}::uuid)`,
    );
    const row = rows[0];
    if (!row) throw new Error("Identity linkage returned no authorization state.");
    return authorizationState(row);
  } catch (error) {
    return translateIdentityError(error);
  }
}

export async function readAuthorizationForIdentity(
  database: Sql,
  authUserId: string,
): Promise<AuthorizationState | null> {
  const rows = await withIdentitySyncRole(
    database,
    (transaction) =>
      transaction<
        AuthorizationRow[]
      >`select * from app.authorization_for_identity(${authUserId}::uuid)`,
  );
  return rows[0] ? authorizationState(rows[0]) : null;
}
