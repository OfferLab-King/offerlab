import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  linkVerifiedIdentity,
  readAuthorizationForIdentity,
} from "../../src/modules/identity-access/infrastructure/identity-linking";
const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  db = postgres(url, { max: 4, prepare: false }),
  roleUrl = new URL(url);
roleUrl.username = "offerlab_identity_sync_login";
roleUrl.password = "postgres";
const identity = postgres(roleUrl.toString(), { max: 4, prepare: false }),
  domain = "@open-registration.test.invalid";
async function auth(id: string, name: string, verified = true) {
  const email = `${name}${domain}`;
  await db`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values('00000000-0000-0000-0000-000000000000',${id}::uuid,'authenticated','authenticated',${email},'',${verified ? new Date() : null},'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')`;
  return email;
}
afterEach(async () => {
  const users = await db<
    { id: string }[]
  >`select id from app."user" where email like ${`%${domain}`}`;
  const ids = users.map((x) => x.id);
  if (ids.length) {
    await db`delete from app.audit_event where actor_user_id=any(${ids}::uuid[])`;
    await db`delete from app.beta_entitlement where user_id=any(${ids}::uuid[])`;
    await db`delete from app."user" where id=any(${ids}::uuid[])`;
  }
  await db`delete from auth.users where email like ${`%${domain}`}`;
});
afterAll(() => Promise.all([db.end(), identity.end()]));
describe("open verified identity linkage", () => {
  it("creates exactly one active normal member without consuming an invitation", async () => {
    const id = "34000000-0000-4000-8000-000000000001",
      email = await auth(id, "member");
    const [first, second] = await Promise.all([
      linkVerifiedIdentity(identity, id),
      linkVerifiedIdentity(identity, id),
    ]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ role: "member", entitlementStatus: "active" });
    expect(await readAuthorizationForIdentity(identity, id)).toEqual(first);
    const rows = await db<
      { invitations: number; users: number; invitation_audits: number; role: string }[]
    >`select (select count(*)::int from app.invitation where email=${email}) invitations,(select count(*)::int from app."user" where auth_user_id=${id}::uuid) users,(select count(*)::int from app.audit_event where actor_user_id=${first.userId}::uuid and action like 'invitation.%') invitation_audits,(select role from app."user" where id=${first.userId}::uuid) role`;
    expect(rows[0]).toEqual({ invitations: 0, users: 1, invitation_audits: 0, role: "member" });
  });
  it("rejects unverified identities without partial state", async () => {
    const id = "34000000-0000-4000-8000-000000000002";
    await auth(id, "unverified", false);
    await expect(linkVerifiedIdentity(identity, id)).rejects.toMatchObject({
      code: "unverified_identity",
    });
    expect(await readAuthorizationForIdentity(identity, id)).toBeNull();
  });
  it("cannot acquire administrator privileges through repeated synchronization", async () => {
    const id = "34000000-0000-4000-8000-000000000003";
    await auth(id, "role");
    const linked = await linkVerifiedIdentity(identity, id);
    expect(linked.role).toBe("member");
    expect((await linkVerifiedIdentity(identity, id)).role).toBe("member");
  });
  it("exposes the open linkage gateway only to identity sync", async () => {
    const rows = await db<
      { anon: boolean; app: boolean; authenticated: boolean; identity_sync: boolean }[]
    >`select has_function_privilege('anon','app.link_open_member_identity(uuid)','execute') anon,has_function_privilege('authenticated','app.link_open_member_identity(uuid)','execute') authenticated,has_function_privilege('offerlab_app','app.link_open_member_identity(uuid)','execute') app,has_function_privilege('offerlab_identity_sync','app.link_open_member_identity(uuid)','execute') identity_sync`;
    expect(rows[0]).toEqual({ anon: false, authenticated: false, app: false, identity_sync: true });
  });
});
