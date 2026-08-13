import { spawnSync } from "node:child_process";
import postgres from "postgres";

import {
  isLoopbackUrl,
  localAuthBypassMember,
  parseLocalAuthBypassArguments,
} from "../src/infrastructure/config/local-development";

function runRequired(command: string, arguments_: readonly string[]) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function roleDatabaseUrl(databaseUrl: string, role: string): string {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = "postgres";
  return url.toString();
}

const bypassRole = parseLocalAuthBypassArguments(process.argv.slice(2));

runRequired("pnpm", ["db:start"]);
const local = JSON.parse(
  runRequired("pnpm", ["exec", "supabase", "status", "-o", "json"]),
) as Record<string, string>;
const databaseUrl = local.DB_URL;
const supabaseUrl = local.API_URL;
const publishableKey = local.PUBLISHABLE_KEY;
if (!databaseUrl) {
  throw new Error("Local Supabase did not report DB_URL.");
}
if (!supabaseUrl) {
  throw new Error(
    "Local Supabase did not report API_URL. Run pnpm db:stop && pnpm db:start, then try again.",
  );
}
if (!publishableKey) {
  throw new Error("Local Supabase did not report PUBLISHABLE_KEY.");
}
if (!isLoopbackUrl(databaseUrl) || !isLoopbackUrl(supabaseUrl)) {
  throw new Error("The local bypass requires the loopback Supabase development stack.");
}

const database = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const rows = await database<{ available: boolean }[]>`
    select exists(
      select 1 from app."user" where id=${localAuthBypassMember.userId}::uuid
    ) as available
  `;
  if (!rows[0]?.available) {
    throw new Error("The local test member is missing. Run pnpm db:reset once, then try again.");
  }

  await database`
    update app."user"
    set role = ${bypassRole}, updated_at = now()
    where id = ${localAuthBypassMember.userId}::uuid
  `;

  const port = process.env.PORT ?? "3000";
  if (!/^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/u.test(port)) {
    throw new Error("PORT must be between 1 and 65535.");
  }
  const appUrl = `http://127.0.0.1:${port}`;
  const accessPath = bypassRole === "administrator" ? "/admin" : "/member";
  process.stdout.write(`Local test access enabled at ${appUrl}${accessPath}\n`);

  const result = spawnSync(
    "pnpm",
    ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port],
    {
      env: {
        ...process.env,
        APP_ENV: "local",
        AUTH_RATE_LIMIT_SECRET:
          process.env.AUTH_RATE_LIMIT_SECRET ?? "local-bypass-rate-limit-secret",
        DATABASE_URL: roleDatabaseUrl(databaseUrl, "offerlab_runtime_login"),
        IDENTITY_SYNC_DATABASE_URL: roleDatabaseUrl(databaseUrl, "offerlab_identity_sync_login"),
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        LOCAL_AUTH_BYPASS_ROLE: bypassRole,
        LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
        NEXT_PUBLIC_APP_URL: appUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NODE_ENV: "development",
      },
      stdio: "inherit",
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  if (bypassRole === "administrator") {
    await database`
      update app."user"
      set role = 'member', updated_at = now()
      where id = ${localAuthBypassMember.userId}::uuid
    `;
  }
  await database.end();
}
