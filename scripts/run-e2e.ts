import { spawnSync } from "node:child_process";

function run(command: string, arguments_: readonly string[], env = process.env): void {
  const result = spawnSync(command, arguments_, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm", ["db:start"]);
run("pnpm", ["db:reset"]);

const status = spawnSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
  encoding: "utf8",
});
if (status.status !== 0) {
  process.stderr.write(status.stderr);
  process.exit(status.status ?? 1);
}
const local = JSON.parse(status.stdout) as Record<string, string>;
const databaseUrl = local.DB_URL;
if (!databaseUrl) throw new Error("Local Supabase did not report DB_URL.");
const authContainer = spawnSync(
  "docker",
  ["inspect", "supabase_auth_offerlab", "--format", "{{range .Config.Env}}{{println .}}{{end}}"],
  { encoding: "utf8" },
);
if (authContainer.status !== 0) throw new Error("Local Supabase Auth container was not available.");
const testSigningKeys = authContainer.stdout
  .split("\n")
  .find((entry) => entry.startsWith("GOTRUE_JWT_KEYS="))
  ?.slice("GOTRUE_JWT_KEYS=".length);
if (!testSigningKeys) throw new Error("Local Supabase Auth signing key was not available.");
const roleDatabaseUrl = (role: string) => {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = "postgres";
  return url.toString();
};
const environment = {
  ...process.env,
  APP_ENV: process.env.APP_ENV ?? "local",
  DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL ?? databaseUrl,
  AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET ?? "local-e2e-rate-limit-secret",
  DATABASE_URL: process.env.DATABASE_URL ?? roleDatabaseUrl("offerlab_runtime_login"),
  IDENTITY_SYNC_DATABASE_URL:
    process.env.IDENTITY_SYNC_DATABASE_URL ?? roleDatabaseUrl("offerlab_identity_sync_login"),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? local.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.API_URL,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? databaseUrl,
  TEST_SUPABASE_SIGNING_KEYS: process.env.TEST_SUPABASE_SIGNING_KEYS ?? testSigningKeys,
};

run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], environment);
