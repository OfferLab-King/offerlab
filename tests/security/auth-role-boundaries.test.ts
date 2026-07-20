import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

function roleUrl(role: string): string {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = "postgres";
  return url.toString();
}

const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeDatabase = postgres(roleUrl("offerlab_runtime_login"), { max: 2, prepare: false });
const identityDatabase = postgres(roleUrl("offerlab_identity_sync_login"), {
  max: 2,
  prepare: false,
});

afterAll(async () => {
  await Promise.all([runtimeDatabase.end(), identityDatabase.end(), migrationDatabase.end()]);
});

describe("production-equivalent database roles", () => {
  it("uses a narrowly privileged non-login owner for every reviewed function", async () => {
    const roles = await migrationDatabase<
      {
        rolbypassrls: boolean;
        rolcanlogin: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolinherit: boolean;
        rolreplication: boolean;
        rolname: string;
        rolsuper: boolean;
      }[]
    >`
      select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
             rolinherit, rolreplication, rolbypassrls
      from pg_roles where rolname = 'offerlab_auth_function_owner'
    `;
    expect(roles).toEqual([
      {
        rolbypassrls: false,
        rolcanlogin: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolname: "offerlab_auth_function_owner",
        rolreplication: false,
        rolsuper: false,
      },
    ]);

    const functions = await migrationDatabase<{ name: string; owner: string }[]>`
      select routine.proname as name, owner.rolname as owner
      from pg_proc as routine
      join pg_namespace as namespace on namespace.oid = routine.pronamespace
      join pg_roles as owner on owner.oid = routine.proowner
      where namespace.nspname = 'app'
        and routine.proname in (
          'invitation_is_usable', 'bind_invitation_to_identity',
          'authorization_for_identity', 'link_verified_identity',
          'check_auth_rate_limit', 'cleanup_expired_auth_rate_limits'
        )
      order by routine.proname
    `;
    expect(functions).toHaveLength(6);
    expect(functions.every(({ owner }) => owner === "offerlab_auth_function_owner")).toBe(true);

    const boundary = await migrationDatabase<
      { can_create_app: boolean; can_read_unrelated: boolean; owns_table: boolean }[]
    >`
      select
        has_schema_privilege('offerlab_auth_function_owner', 'app', 'create') as can_create_app,
        has_table_privilege('offerlab_auth_function_owner', 'app.audit_event', 'select')
          as can_read_unrelated,
        exists (
          select 1 from pg_class
          where relowner = 'offerlab_auth_function_owner'::regrole
        ) as owns_table
    `;
    expect(boundary[0]).toEqual({
      can_create_app: false,
      can_read_unrelated: false,
      owns_table: false,
    });
  });

  it("keeps both web logins non-owner, non-superuser and unable to bypass RLS", async () => {
    const rows = await migrationDatabase<
      {
        rolbypassrls: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolname: string;
        rolsuper: boolean;
      }[]
    >`
      select rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      from pg_roles
      where rolname in ('offerlab_runtime_login', 'offerlab_identity_sync_login')
      order by rolname
    `;
    expect(rows).toEqual([
      {
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolname: "offerlab_identity_sync_login",
        rolsuper: false,
      },
      {
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolname: "offerlab_runtime_login",
        rolsuper: false,
      },
    ]);
  });

  it("prevents runtime DDL, sensitive reads and arbitrary authorization projection", async () => {
    await expect(runtimeDatabase`create table public.runtime_escape(id integer)`).rejects.toThrow();
    await expect(runtimeDatabase`select * from app.invitation`).rejects.toThrow(
      /permission denied/,
    );
    await expect(runtimeDatabase`select * from app.audit_event`).rejects.toThrow(
      /permission denied/,
    );
    await expect(runtimeDatabase`select * from auth.users`).rejects.toThrow(/permission denied/);
    await expect(
      runtimeDatabase`select * from app.authorization_for_identity('10000000-0000-4000-8000-000000000002')`,
    ).rejects.toThrow(/permission denied/);
  });

  it("enforces own-row RLS and denies cross-user writes after assuming the app role", async () => {
    const rows = await runtimeDatabase.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      await transaction`select set_config('app.current_user_id', '20000000-0000-4000-8000-000000000001', true)`;
      return transaction<{ id: string }[]>`select id from app."user" order by id`;
    });
    expect(rows).toEqual([{ id: "20000000-0000-4000-8000-000000000001" }]);
    await expect(
      runtimeDatabase.begin(async (transaction) => {
        await transaction`set local role offerlab_app`;
        await transaction`select set_config('app.current_user_id', '20000000-0000-4000-8000-000000000001', true)`;
        return transaction`
          update app."user" set role = 'administrator'
          where id = '20000000-0000-4000-8000-000000000002'
        `;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("allows identity sync only through narrow functions", async () => {
    await expect(
      identityDatabase`create table public.identity_escape(id integer)`,
    ).rejects.toThrow();
    await expect(identityDatabase`select * from app.invitation`).rejects.toThrow(
      /permission denied/,
    );
    await expect(identityDatabase`select * from app.audit_event`).rejects.toThrow(
      /permission denied/,
    );
    const rows = await identityDatabase.begin(async (transaction) => {
      await transaction`set local role offerlab_identity_sync`;
      return transaction<{ user_id: string }[]>`
        select user_id
        from app.authorization_for_identity('10000000-0000-4000-8000-000000000001')
      `;
    });
    expect(rows).toEqual([{ user_id: "20000000-0000-4000-8000-000000000001" }]);
  });

  it("exposes authentication functions only to the identity-sync role", async () => {
    const signatures = [
      "app.invitation_is_usable(text,text)",
      "app.bind_invitation_to_identity(text,uuid)",
      "app.authorization_for_identity(uuid)",
      "app.link_verified_identity(uuid)",
      "app.check_auth_rate_limit(text,text)",
      "app.cleanup_expired_auth_rate_limits()",
    ];
    for (const signature of signatures) {
      const rows = await migrationDatabase<
        {
          anon: boolean;
          authenticated: boolean;
          identity_sync: boolean;
          public: boolean;
          runtime: boolean;
        }[]
      >`
        select
          has_function_privilege('public', ${signature}, 'execute') as public,
          has_function_privilege('anon', ${signature}, 'execute') as anon,
          has_function_privilege('authenticated', ${signature}, 'execute') as authenticated,
          has_function_privilege('offerlab_app', ${signature}, 'execute') as runtime,
          has_function_privilege('offerlab_identity_sync', ${signature}, 'execute') as identity_sync
      `;
      expect(rows[0]).toEqual({
        anon: false,
        authenticated: false,
        identity_sync: true,
        public: false,
        runtime: false,
      });
    }
  });

  it("denies execution on future postgres-owned functions by default", async () => {
    const defaultAcl = await migrationDatabase<
      { configured: boolean; object_types: string[]; public_execute: boolean }[]
    >`
      select
        count(*) > 0 as configured,
        array_agg(distinct defaults.defaclobjtype order by defaults.defaclobjtype)
          as object_types,
        coalesce(
        bool_or(
          expanded.grantee = 0
          and expanded.privilege_type = 'EXECUTE'
        ),
        false
      ) as public_execute
      from pg_default_acl as defaults
      cross join lateral aclexplode(defaults.defaclacl) as expanded
      where defaults.defaclrole = 'postgres'::regrole
        and defaults.defaclnamespace = 0
    `;
    expect(defaultAcl).toEqual([{ configured: true, object_types: ["f"], public_execute: false }]);

    await expect(
      migrationDatabase.begin(async (transaction) => {
        await transaction`
          create function app.future_auth_function_acl_probe()
          returns integer
          language sql
          as 'select 1'
        `;
        const privileges = await transaction<
          {
            anon: boolean;
            authenticated: boolean;
            identity_sync: boolean;
            public: boolean;
            runtime_group: boolean;
            runtime_login: boolean;
          }[]
        >`
          select
            has_function_privilege(
              'public', 'app.future_auth_function_acl_probe()', 'execute'
            ) as public,
            has_function_privilege(
              'anon', 'app.future_auth_function_acl_probe()', 'execute'
            ) as anon,
            has_function_privilege(
              'authenticated', 'app.future_auth_function_acl_probe()', 'execute'
            ) as authenticated,
            has_function_privilege(
              'offerlab_app', 'app.future_auth_function_acl_probe()', 'execute'
            ) as runtime_group,
            has_function_privilege(
              'offerlab_runtime_login', 'app.future_auth_function_acl_probe()', 'execute'
            ) as runtime_login,
            has_function_privilege(
              'offerlab_identity_sync', 'app.future_auth_function_acl_probe()', 'execute'
            ) as identity_sync
        `;
        expect(privileges).toEqual([
          {
            anon: false,
            authenticated: false,
            identity_sync: false,
            public: false,
            runtime_group: false,
            runtime_login: false,
          },
        ]);
        throw new Error("rollback future function ACL probe");
      }),
    ).rejects.toThrow("rollback future function ACL probe");

    const probe = await migrationDatabase<{ function_name: string | null }[]>`
      select to_regprocedure('app.future_auth_function_acl_probe()')::text as function_name
    `;
    expect(probe).toEqual([{ function_name: null }]);
  });

  it("denies unauthenticated database access to authentication data", async () => {
    await expect(
      migrationDatabase.begin(async (transaction) => {
        await transaction`set local role anon`;
        return transaction`select * from app."user"`;
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      migrationDatabase.begin(async (transaction) => {
        await transaction`set local role anon`;
        return transaction`select * from app.beta_entitlement`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("enforces the database-backed limit without exposing its table", async () => {
    const fingerprint = "f".repeat(64);
    await migrationDatabase`delete from app.auth_rate_limit where key_hash = ${fingerprint}`;
    const decisions: boolean[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const rows = await identityDatabase.begin(async (transaction) => {
        await transaction`set local role offerlab_identity_sync`;
        return transaction<{ allowed: boolean }[]>`
          select allowed
          from app.check_auth_rate_limit('registration', ${fingerprint})
        `;
      });
      decisions.push(rows[0]?.allowed ?? false);
    }
    expect(decisions).toEqual([true, true, true, true, true, false]);
    await expect(identityDatabase`select * from app.auth_rate_limit`).rejects.toThrow(
      /permission denied/,
    );
    await migrationDatabase`delete from app.auth_rate_limit where key_hash = ${fingerprint}`;
  });

  it("serializes concurrent limiter attempts so only the configured count succeeds", async () => {
    const fingerprint = "e".repeat(64);
    await migrationDatabase`delete from app.auth_rate_limit where key_hash = ${fingerprint}`;
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () =>
        identityDatabase.begin(async (transaction) => {
          await transaction`set local role offerlab_identity_sync`;
          const rows = await transaction<{ allowed: boolean }[]>`
            select allowed from app.check_auth_rate_limit('registration', ${fingerprint})
          `;
          return rows[0]?.allowed ?? false;
        }),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(5);
    await migrationDatabase`delete from app.auth_rate_limit where key_hash = ${fingerprint}`;
  });

  it("cleans expired high-cardinality rows in capped repeatable batches", async () => {
    await migrationDatabase`delete from app.auth_rate_limit where action = 'recovery'`;
    await migrationDatabase`
      insert into app.auth_rate_limit (action, key_hash, window_started_at, attempt_count)
      select 'recovery', lpad(to_hex(item), 64, '0'), now() - interval '25 hours', 1
      from generate_series(1, 1201) as item
    `;
    const activeFingerprint = "a".repeat(64);
    await migrationDatabase`
      insert into app.auth_rate_limit values ('recovery', ${activeFingerprint}, now(), 1)
    `;

    const deleted: number[] = [];
    for (let pass = 0; pass < 3; pass += 1) {
      const rows = await identityDatabase.begin(async (transaction) => {
        await transaction`set local role offerlab_identity_sync`;
        return transaction<{ deleted: number }[]>`
          select app.cleanup_expired_auth_rate_limits() as deleted
        `;
      });
      deleted.push(rows[0]?.deleted ?? -1);
    }
    expect(deleted).toEqual([500, 500, 201]);
    const remaining = await migrationDatabase<{ active: number; expired: number }[]>`
      select
        count(*) filter (where key_hash = ${activeFingerprint})::int as active,
        count(*) filter (where window_started_at < now() - interval '24 hours')::int as expired
      from app.auth_rate_limit where action = 'recovery'
    `;
    expect(remaining[0]).toEqual({ active: 1, expired: 0 });
    await migrationDatabase`delete from app.auth_rate_limit where action = 'recovery'`;
  });
});

describe("authentication schema invariants", () => {
  it.each([
    [
      "expiry before creation",
      () => migrationDatabase`
        insert into app.invitation (email, token_hash, created_at, expires_at)
        values ('constraint-expiry@test.invalid', ${"1".repeat(64)}, now(), now() - interval '1 second')
      `,
    ],
    [
      "incomplete binding",
      () => migrationDatabase`
        insert into app.invitation (email, token_hash, created_at, expires_at, bound_at)
        values ('constraint-binding@test.invalid', ${"2".repeat(64)}, now(), now() + interval '1 hour', now())
      `,
    ],
    [
      "revoked and consumed",
      () => migrationDatabase`
        insert into app.invitation (
          email, token_hash, created_at, expires_at, bound_auth_user_id, bound_at,
          consumed_at, consumed_by_user_id, revoked_at
        ) values (
          'constraint-final@test.invalid', ${"3".repeat(64)}, now() - interval '1 minute',
          now() + interval '1 hour', '10000000-0000-4000-8000-000000000001',
          now() - interval '30 seconds', now(), '20000000-0000-4000-8000-000000000001', now()
        )
      `,
    ],
    [
      "consumption before creation",
      () => migrationDatabase`
        insert into app.invitation (
          email, token_hash, created_at, expires_at, bound_auth_user_id, bound_at,
          consumed_at, consumed_by_user_id
        ) values (
          'constraint-consumed-time@test.invalid', ${"4".repeat(64)}, now(),
          now() + interval '1 hour', '10000000-0000-4000-8000-000000000001',
          now(), now() - interval '1 second', '20000000-0000-4000-8000-000000000001'
        )
      `,
    ],
    [
      "revocation before creation",
      () => migrationDatabase`
        insert into app.invitation (email, token_hash, created_at, expires_at, revoked_at)
        values (
          'constraint-revoked-time@test.invalid', ${"5".repeat(64)}, now(),
          now() + interval '1 hour', now() - interval '1 second'
        )
      `,
    ],
    [
      "incomplete consumption",
      () => migrationDatabase`
        insert into app.invitation (
          email, token_hash, created_at, expires_at, bound_auth_user_id, bound_at, consumed_at
        ) values (
          'constraint-consumption-fields@test.invalid', ${"6".repeat(64)},
          now() - interval '1 minute', now() + interval '1 hour',
          '10000000-0000-4000-8000-000000000001', now() - interval '30 seconds', now()
        )
      `,
    ],
  ])("rejects contradictory state: %s", async (_name, query) => {
    await expect(query()).rejects.toThrow();
  });

  it.each([
    ["active with revocation", "active", new Date()],
    ["revoked without revocation", "revoked", null],
  ])("rejects contradictory entitlement state: %s", async (_name, status, revokedAt) => {
    await expect(
      migrationDatabase`
        insert into app.beta_entitlement (user_id, status, activated_at, revoked_at)
        values (
          '20000000-0000-4000-8000-000000000001', ${status}, now() - interval '1 minute',
          ${revokedAt}
        )
      `,
    ).rejects.toThrow();
  });

  it("rejects an entitlement update timestamp before activation", async () => {
    await expect(
      migrationDatabase`
        insert into app.beta_entitlement (user_id, status, activated_at, updated_at)
        values (
          '20000000-0000-4000-8000-000000000001', 'active', now(),
          now() - interval '1 second'
        )
      `,
    ).rejects.toThrow();
  });

  it("contains no OfferLab password-reset authority", async () => {
    const rows = await migrationDatabase<{ reset_table: string | null }[]>`
      select to_regclass('app.password_reset_ticket')::text as reset_table
    `;
    expect(rows[0]?.reset_table).toBeNull();
  });

  it("prevents external and internal identity mappings from becoming ambiguous", async () => {
    await expect(
      migrationDatabase`
        insert into app."user" (auth_user_id, email)
        values (
          '10000000-0000-4000-8000-000000000001',
          'second-mapping-for-one-external@test.invalid'
        )
      `,
    ).rejects.toThrow();
    await expect(
      migrationDatabase`
        update app."user"
        set email = (select email from app."user" where id = '20000000-0000-4000-8000-000000000001')
        where id = '20000000-0000-4000-8000-000000000002'
      `,
    ).rejects.toThrow();
  });

  it("enables and forces RLS on every authentication table", async () => {
    const rows = await migrationDatabase<
      { relforcerowsecurity: boolean; relname: string; relrowsecurity: boolean }[]
    >`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where oid in (
        'app.user'::regclass,
        'app.audit_event'::regclass,
        'app.invitation'::regclass,
        'app.beta_entitlement'::regclass,
        'app.auth_rate_limit'::regclass
      )
      order by relname
    `;
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
});
