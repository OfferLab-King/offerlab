import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { constants } from "node:os";
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

type ChildExit = Readonly<{ code: number | null; signal: NodeJS.Signals | null }>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function waitForChildExit(child: ChildProcess): Promise<ChildExit> {
  return new Promise((resolve, reject) => {
    let settled = false;
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(new Error(`Next.js development server failed to start: ${errorMessage(error)}`));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      resolve({ code, signal });
    });
  });
}

function signalExitCode(signal: NodeJS.Signals): number {
  return 128 + (constants.signals[signal] ?? 1);
}

async function runNextDevelopmentServer(
  environment: NodeJS.ProcessEnv,
  port: string,
): Promise<number> {
  const child = spawn("pnpm", ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port], {
    detached: true,
    env: environment,
    stdio: "inherit",
  });
  let forwardedSignal: NodeJS.Signals | null = null;
  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (forwardedSignal) return;
    forwardedSignal = signal;
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  };
  const handleSigint = (): void => forwardSignal("SIGINT");
  const handleSigterm = (): void => forwardSignal("SIGTERM");
  process.on("SIGINT", handleSigint);
  process.on("SIGTERM", handleSigterm);

  let childExit: ChildExit;
  try {
    childExit = await waitForChildExit(child);
  } finally {
    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
  }

  if (forwardedSignal) {
    const childResult = childExit.signal
      ? `signal ${childExit.signal}`
      : `exit code ${childExit.code ?? "unknown"}`;
    process.stdout.write(
      `Local bypass shutdown forwarded ${forwardedSignal}; Next.js ended with ${childResult}.\n`,
    );
    return signalExitCode(forwardedSignal);
  }
  if (childExit.signal) {
    throw new Error(`Next.js development server stopped from signal ${childExit.signal}.`);
  }
  if (childExit.code === null) {
    throw new Error("Next.js development server exited without an exit code or signal.");
  }
  if (childExit.code !== 0) {
    process.stderr.write(`Next.js development server exited with code ${childExit.code}.\n`);
  }
  return childExit.code;
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
let launcherFailure: unknown;
let promotedDeterministicUser = false;
try {
  const rows = await database<{ available: boolean }[]>`
    select exists(
      select 1 from app."user" where id=${localAuthBypassMember.userId}::uuid
    ) as available
  `;
  if (!rows[0]?.available) {
    throw new Error("The local test member is missing. Run pnpm db:reset once, then try again.");
  }

  let bypassUserId: string = localAuthBypassMember.userId;
  if (bypassRole === "member") {
    await database`
      update app."user"
      set role = 'member', updated_at = now()
      where id = ${localAuthBypassMember.userId}::uuid
    `;
  } else {
    const administrators = await database<{ id: string }[]>`
      select id::text
      from app."user"
      where role = 'administrator'
      limit 1
    `;
    const existingAdministrator = administrators[0];
    if (existingAdministrator) {
      bypassUserId = existingAdministrator.id;
    } else {
      await database`
        update app."user"
        set role = 'administrator', updated_at = now()
        where id = ${localAuthBypassMember.userId}::uuid
      `;
      promotedDeterministicUser = true;
    }
  }

  const port = process.env.PORT ?? "3000";
  if (!/^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/u.test(port)) {
    throw new Error("PORT must be between 1 and 65535.");
  }
  const appUrl = `http://127.0.0.1:${port}`;
  const accessPath = bypassRole === "administrator" ? "/admin" : "/member";
  process.stdout.write(`Local test access enabled at ${appUrl}${accessPath}\n`);

  process.exitCode = await runNextDevelopmentServer(
    {
      ...process.env,
      APP_ENV: "local",
      AUTH_RATE_LIMIT_SECRET:
        process.env.AUTH_RATE_LIMIT_SECRET ?? "local-bypass-rate-limit-secret",
      DATABASE_URL: roleDatabaseUrl(databaseUrl, "offerlab_runtime_login"),
      IDENTITY_SYNC_DATABASE_URL: roleDatabaseUrl(databaseUrl, "offerlab_identity_sync_login"),
      LOCAL_AUTH_BYPASS_ENABLED: "true",
      LOCAL_AUTH_BYPASS_ROLE: bypassRole,
      LOCAL_AUTH_BYPASS_USER_ID: bypassUserId,
      LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
      NEXT_PUBLIC_APP_URL: appUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NODE_ENV: "development",
    },
    port,
  );
} catch (error) {
  launcherFailure = error;
} finally {
  let restorationFailure: unknown;
  let connectionCloseFailure: unknown;
  try {
    if (promotedDeterministicUser) {
      await database`
        update app."user"
        set role = 'member', updated_at = now()
        where id = ${localAuthBypassMember.userId}::uuid
      `;
    }
  } catch (error) {
    restorationFailure = error;
  } finally {
    try {
      await database.end();
    } catch (error) {
      connectionCloseFailure = error;
    }
  }

  const failures = [launcherFailure, restorationFailure, connectionCloseFailure].filter(
    (failure): failure is NonNullable<typeof failure> => failure !== undefined,
  );
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      "The local bypass launcher failed and cleanup was incomplete.",
    );
  }
}
