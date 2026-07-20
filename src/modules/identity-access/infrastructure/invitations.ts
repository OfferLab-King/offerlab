import type { Sql } from "postgres";

import { IdentityAccessError } from "../application/errors";
import { generateInvitationToken, hashInvitationToken } from "../domain/invitation-token";
import { withIdentitySyncRole } from "./identity-sync-database";

type InvitationRow = Readonly<{
  consumed_at: Date | null;
  email: string;
  expires_at: Date;
  id: string;
  revoked_at: Date | null;
}>;

export type CreatedInvitation = Readonly<{
  email: string;
  expiresAt: Date;
  id: string;
  token: string;
}>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createInvitation(
  database: Sql,
  input: Readonly<{ email: string; expiresAt: Date; actorUserId?: string }>,
): Promise<CreatedInvitation> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) throw new Error("A valid email address is required.");
  if (input.expiresAt.getTime() <= Date.now()) throw new Error("Invitation expiry must be future.");

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const invitation = await database.begin(async (transaction) => {
    const rows = await transaction<InvitationRow[]>`
      insert into app.invitation (email, token_hash, expires_at, created_by_user_id)
      values (${email}, ${tokenHash}, ${input.expiresAt}, ${input.actorUserId ?? null}::uuid)
      returning id, email, expires_at, revoked_at, consumed_at
    `;
    const created = rows[0];
    if (!created) throw new Error("Invitation creation did not return a row.");
    await transaction`
      insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${input.actorUserId ?? null}::uuid,
        'invitation.created',
        'invitation',
        ${created.id}::uuid,
        jsonb_build_object('expires_at', ${input.expiresAt.toISOString()}::text)
      )
    `;
    return created;
  });
  return { email, expiresAt: invitation.expires_at, id: invitation.id, token };
}

export async function revokeInvitation(
  database: Sql,
  invitationId: string,
  actorUserId?: string,
): Promise<void> {
  await database.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      update app.invitation
      set revoked_at = now()
      where id = ${invitationId}::uuid and revoked_at is null and consumed_at is null
      returning id
    `;
    if (!rows[0])
      throw new IdentityAccessError("invalid_invitation", "Invitation cannot be revoked.");
    await transaction`
      insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
      values (${actorUserId ?? null}::uuid, 'invitation.revoked', 'invitation', ${invitationId}::uuid, '{}'::jsonb)
    `;
  });
}

export async function assertUsableInvitation(
  database: Sql,
  token: string,
  email: string,
): Promise<void> {
  const rows = await withIdentitySyncRole(
    database,
    (transaction) =>
      transaction<{ usable: boolean }[]>`
      select app.invitation_is_usable(${hashInvitationToken(token)}, ${normalizeEmail(email)}) as usable
    `,
  );
  if (!rows[0]?.usable) {
    throw new IdentityAccessError("invalid_invitation", "Invitation is invalid or unavailable.");
  }
}

export async function bindInvitationToIdentity(
  database: Sql,
  input: Readonly<{ authUserId: string; token: string }>,
): Promise<boolean> {
  const rows = await withIdentitySyncRole(
    database,
    (transaction) =>
      transaction<{ bound: boolean }[]>`
      select app.bind_invitation_to_identity(
        ${hashInvitationToken(input.token)},
        ${input.authUserId}::uuid
      ) as bound
    `,
  );
  return rows[0]?.bound === true;
}
