import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { IdentityAccessError } from "../../src/modules/identity-access/application/errors";
import { hashInvitationToken } from "../../src/modules/identity-access/domain/invitation-token";
import { revokeBetaEntitlement } from "../../src/modules/identity-access/infrastructure/entitlements";
import {
  linkVerifiedIdentity,
  readAuthorizationForIdentity,
} from "../../src/modules/identity-access/infrastructure/identity-linking";
import {
  assertUsableInvitation,
  bindInvitationToIdentity,
  createInvitation,
  revokeInvitation,
} from "../../src/modules/identity-access/infrastructure/invitations";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, { max: 10, prepare: false });
function roleUrl(role: string): string {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = "postgres";
  return url.toString();
}
const identityDatabase = postgres(roleUrl("offerlab_identity_sync_login"), {
  max: 10,
  prepare: false,
});
const testDomain = "@auth-invite.test.invalid";

async function insertAuthUser(id: string, localPart: string, verified = true): Promise<string> {
  const email = `${localPart}${testDomain}`;
  await database`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', ${id}::uuid, 'authenticated',
      'authenticated', ${email}, '', ${verified ? new Date() : null},
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    )
  `;
  return email;
}

beforeEach(async () => {
  await database`update app."user" set role = 'member' where role = 'administrator'`;
});

afterEach(async () => {
  await database`delete from app.audit_event where entity_id in (
    select id from app."user" where email like ${`%${testDomain}`}
    union select id from app.invitation where email like ${`%${testDomain}`}
  )`;
  await database`delete from app.audit_event where entity_type in ('invitation', 'user') and action like 'beta_entitlement.%'`;
  await database`delete from app.invitation where email like ${`%${testDomain}`}`;
  await database`delete from app.beta_entitlement where user_id in (
    select id from app."user" where email like ${`%${testDomain}`}
  )`;
  await database`delete from app."user" where email like ${`%${testDomain}`}`;
  await database`delete from auth.users where email like ${`%${testDomain}`}`;
  await database`
    delete from app.beta_entitlement
    where user_id in (
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    )
  `;
});

afterAll(async () => {
  await identityDatabase.end();
  await database.end();
});

describe("invitations", () => {
  it("creates a hashed invitation and durable audit event", async () => {
    const invitation = await createInvitation(database, {
      email: `CREATE${testDomain}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const rows = await database<{ action: string; metadata: unknown; token_hash: string }[]>`
      select invitation.token_hash, audit.action, audit.metadata
      from app.invitation as invitation
      join app.audit_event as audit on audit.entity_id = invitation.id
      where invitation.id = ${invitation.id}::uuid
    `;
    expect(rows).toEqual([
      {
        action: "invitation.created",
        metadata: { expires_at: invitation.expiresAt.toISOString() },
        token_hash: hashInvitationToken(invitation.token),
      },
    ]);
    expect(rows[0]?.token_hash).not.toBe(invitation.token);
    expect(JSON.stringify(rows[0]?.metadata)).not.toContain(invitation.token);
  });

  it("rejects expired, revoked, consumed and email-mismatched invitations", async () => {
    const token = "expired-token";
    await database`
      insert into app.invitation (email, token_hash, created_at, expires_at)
      values (
        ${`expired${testDomain}`},
        ${hashInvitationToken(token)},
        now() - interval '2 minutes',
        now() - interval '1 minute'
      )
    `;
    await expect(
      assertUsableInvitation(identityDatabase, token, `expired${testDomain}`),
    ).rejects.toThrow(IdentityAccessError);

    const revoked = await createInvitation(database, {
      email: `revoked${testDomain}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await revokeInvitation(database, revoked.id);
    await expect(
      assertUsableInvitation(identityDatabase, revoked.token, `revoked${testDomain}`),
    ).rejects.toThrow(IdentityAccessError);

    const consumed = await createInvitation(database, {
      email: `consumed${testDomain}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const consumedAuthId = "31000000-0000-4000-8000-000000000009";
    await insertAuthUser(consumedAuthId, "consumed");
    expect(
      await bindInvitationToIdentity(identityDatabase, {
        authUserId: consumedAuthId,
        token: consumed.token,
      }),
    ).toBe(true);
    await linkVerifiedIdentity(identityDatabase, consumedAuthId);
    await expect(
      assertUsableInvitation(identityDatabase, consumed.token, `consumed${testDomain}`),
    ).rejects.toThrow(IdentityAccessError);
    await expect(
      assertUsableInvitation(identityDatabase, consumed.token, `wrong${testDomain}`),
    ).rejects.toThrow(IdentityAccessError);
  });

  it("binds and consumes exactly one invitation under concurrent linkage", async () => {
    const authId = "31000000-0000-4000-8000-000000000010";
    await insertAuthUser(authId, "race");
    const invitation = await createInvitation(database, {
      email: `race${testDomain}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: authId,
      token: invitation.token,
    });
    const results = await Promise.all([
      linkVerifiedIdentity(identityDatabase, authId),
      linkVerifiedIdentity(identityDatabase, authId),
    ]);
    expect(results[0]?.userId).toBe(results[1]?.userId);
    const audits = await database<{ count: number }[]>`
      select count(*)::int as count from app.audit_event
      where entity_id = ${invitation.id}::uuid and action = 'invitation.consumed'
    `;
    expect(audits[0]?.count).toBe(1);
  });
});

describe("verified identity linkage", () => {
  it("cannot link an invited email until the exact bearer invitation is bound", async () => {
    const authId = "31000000-0000-4000-8000-000000000011";
    const email = await insertAuthUser(authId, "unbound");
    await createInvitation(database, { email, expiresAt: new Date(Date.now() + 60_000) });
    await expect(linkVerifiedIdentity(identityDatabase, authId)).rejects.toMatchObject({
      code: "invalid_invitation",
    });
  });

  it("consumes the exact presented row when two invitations share an email", async () => {
    const authId = "31000000-0000-4000-8000-000000000012";
    const email = await insertAuthUser(authId, "exact-row");
    const first = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const second = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(
      await bindInvitationToIdentity(identityDatabase, { authUserId: authId, token: first.token }),
    ).toBe(true);
    expect(
      await bindInvitationToIdentity(identityDatabase, { authUserId: authId, token: second.token }),
    ).toBe(false);
    await linkVerifiedIdentity(identityDatabase, authId);
    const rows = await database<{ consumed_at: Date | null; id: string }[]>`
      select id, consumed_at from app.invitation
      where id in (${first.id}::uuid, ${second.id}::uuid)
      order by id
    `;
    expect(rows.find(({ id }) => id === first.id)?.consumed_at).toBeInstanceOf(Date);
    expect(rows.find(({ id }) => id === second.id)?.consumed_at).toBeNull();
  });

  it("atomically creates a user, consumes the invite, grants entitlement and audits", async () => {
    const authId = "31000000-0000-4000-8000-000000000001";
    const email = await insertAuthUser(authId, "atomic");
    const invitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: authId,
      token: invitation.token,
    });
    const linked = await linkVerifiedIdentity(identityDatabase, authId);

    expect(linked.entitlementStatus).toBe("active");
    const state = await database<
      { consumed_by_user_id: string; status: string; user_id: string }[]
    >`
      select invitation.consumed_by_user_id, entitlement.status, entitlement.user_id
      from app.invitation as invitation
      join app.beta_entitlement as entitlement
        on entitlement.user_id = invitation.consumed_by_user_id
      where invitation.id = ${invitation.id}::uuid
    `;
    expect(state[0]).toMatchObject({ status: "active", user_id: linked.userId });
    const audits = await database<{ action: string }[]>`
      select action from app.audit_event
      where actor_user_id = ${linked.userId}::uuid
      order by action
    `;
    expect(audits.map(({ action }) => action)).toEqual([
      "beta_entitlement.activated",
      "identity.linked",
      "invitation.consumed",
    ]);
  });

  it("is idempotent and concurrent-safe with one internal user", async () => {
    const authId = "31000000-0000-4000-8000-000000000002";
    const email = await insertAuthUser(authId, "idempotent");
    const invitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: authId,
      token: invitation.token,
    });

    const [first, second] = await Promise.all([
      linkVerifiedIdentity(identityDatabase, authId),
      linkVerifiedIdentity(identityDatabase, authId),
    ]);
    expect(first.userId).toBe(second.userId);
    expect((await linkVerifiedIdentity(identityDatabase, authId)).userId).toBe(first.userId);
    const rows = await database<{ count: number }[]>`
      select count(*)::int as count from app."user" where auth_user_id = ${authId}::uuid
    `;
    expect(rows[0]?.count).toBe(1);
  });

  it("recovers after an earlier internal transaction did not run", async () => {
    const authId = "31000000-0000-4000-8000-000000000003";
    const email = await insertAuthUser(authId, "recovery");
    const invitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: authId,
      token: invitation.token,
    });
    expect(await readAuthorizationForIdentity(identityDatabase, authId)).toBeNull();
    await expect(linkVerifiedIdentity(identityDatabase, authId)).resolves.toMatchObject({
      entitlementStatus: "active",
    });
  });

  it("rejects unverified and duplicate identities without partial state", async () => {
    const unverifiedId = "31000000-0000-4000-8000-000000000004";
    const email = await insertAuthUser(unverifiedId, "unverified", false);
    const unverifiedInvitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: unverifiedId,
      token: unverifiedInvitation.token,
    });
    await expect(linkVerifiedIdentity(identityDatabase, unverifiedId)).rejects.toMatchObject({
      code: "unverified_identity",
    });

    const firstId = "31000000-0000-4000-8000-000000000005";
    const secondId = "31000000-0000-4000-8000-000000000006";
    await insertAuthUser(firstId, "identity-owner");
    const duplicateEmail = await insertAuthUser(secondId, "duplicate");
    await database`
      insert into app."user" (auth_user_id, email)
      values (${firstId}::uuid, ${duplicateEmail})
    `;
    const duplicateInvitation = await createInvitation(database, {
      email: duplicateEmail,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: secondId,
      token: duplicateInvitation.token,
    });
    await expect(linkVerifiedIdentity(identityDatabase, secondId)).rejects.toMatchObject({
      code: "duplicate_identity",
    });
    const partial = await database<{ count: number }[]>`
      select count(*)::int as count from app.beta_entitlement
      where user_id in (select id from app."user" where auth_user_id = ${secondId}::uuid)
    `;
    expect(partial[0]?.count).toBe(0);
  });
});

describe("entitlement, administrator separation and RLS", () => {
  it("represents active and revoked access independently from administrator role", async () => {
    const authId = "31000000-0000-4000-8000-000000000007";
    const email = await insertAuthUser(authId, "role");
    const invitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await bindInvitationToIdentity(identityDatabase, {
      authUserId: authId,
      token: invitation.token,
    });
    const linked = await linkVerifiedIdentity(identityDatabase, authId);
    await database`update app."user" set role = 'administrator' where id = ${linked.userId}::uuid`;
    expect(await readAuthorizationForIdentity(identityDatabase, authId)).toMatchObject({
      entitlementStatus: "active",
      role: "administrator",
    });
    await revokeBetaEntitlement(database, linked.userId);
    expect(await readAuthorizationForIdentity(identityDatabase, authId)).toMatchObject({
      entitlementStatus: "revoked",
      role: "administrator",
    });
  });

  it("allows an application role to read only its own entitlement", async () => {
    await database`
      insert into app.beta_entitlement (user_id, status, activated_at)
      values
        ('20000000-0000-4000-8000-000000000001', 'active', now()),
        ('20000000-0000-4000-8000-000000000002', 'active', now())
      on conflict (user_id) do update set status = 'active', revoked_at = null
    `;
    const rows = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      await transaction`select set_config('app.current_user_id', '20000000-0000-4000-8000-000000000001', true)`;
      return transaction<
        { user_id: string }[]
      >`select user_id from app.beta_entitlement order by user_id`;
    });
    expect(rows).toEqual([{ user_id: "20000000-0000-4000-8000-000000000001" }]);
    await expect(
      database.begin(async (transaction) => {
        await transaction`set local role offerlab_app`;
        return transaction`select * from app.invitation`;
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
