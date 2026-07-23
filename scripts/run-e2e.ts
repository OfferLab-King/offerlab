import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

function run(command: string, arguments_: readonly string[], env = process.env): number {
  const result = spawnSync(command, arguments_, { env, stdio: "inherit" });
  return result.status ?? 1;
}

function runRequired(command: string, arguments_: readonly string[], env = process.env): void {
  const status = run(command, arguments_, env);
  if (status !== 0) process.exit(status);
}

const skipReset = process.argv.includes("--skip-reset");
const playwrightArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--skip-reset" && argument !== "--");
runRequired("pnpm", ["db:start"]);
if (!skipReset) runRequired("pnpm", ["db:reset"]);

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
const authHealthUrl = local.API_URL && `${local.API_URL}/auth/v1/health`;
if (!authHealthUrl) throw new Error("Local Supabase did not report API_URL.");
let authReady = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const response = await fetch(authHealthUrl);
    if (response.ok) {
      authReady = true;
      break;
    }
  } catch {
    // The local Auth container can briefly refuse connections immediately after a reset.
  }
  await delay(200);
}
if (!authReady) throw new Error("Local Supabase Auth did not become ready after reset.");
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
async function reserveAvailablePort(): Promise<string> {
  if (process.env.E2E_PORT) return process.env.E2E_PORT;
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve an E2E port.");
  const port = String(address.port);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

const e2ePort = await reserveAvailablePort();
const e2eDistDirectory = `.next-e2e-${e2ePort}`;
const generatedConfigurationFiles = ["next-env.d.ts", "tsconfig.json"].map((path) => ({
  contents: readFileSync(path),
  path,
}));
const environment = {
  ...process.env,
  APP_ENV: process.env.APP_ENV ?? "local",
  DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL ?? databaseUrl,
  AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET ?? "local-e2e-rate-limit-secret",
  DATABASE_URL: process.env.DATABASE_URL ?? roleDatabaseUrl("offerlab_runtime_login"),
  IDENTITY_SYNC_DATABASE_URL:
    process.env.IDENTITY_SYNC_DATABASE_URL ?? roleDatabaseUrl("offerlab_identity_sync_login"),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  NEXT_DIST_DIR: e2eDistDirectory,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? `http://127.0.0.1:${e2ePort}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? local.PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.API_URL,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  E2E_PORT: e2ePort,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? databaseUrl,
  TEST_SUPABASE_SIGNING_KEYS: process.env.TEST_SUPABASE_SIGNING_KEYS ?? testSigningKeys,
};

let testStatus = 1;
try {
  testStatus = run("pnpm", ["exec", "playwright", "test", ...playwrightArguments], environment);
} finally {
  rmSync(e2eDistDirectory, { force: true, recursive: true });
  for (const file of generatedConfigurationFiles) writeFileSync(file.path, file.contents);
}
process.exit(testStatus);
