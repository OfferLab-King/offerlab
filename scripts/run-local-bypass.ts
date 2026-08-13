import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  isLoopbackUrl,
  localAuthBypassMember,
  parseLocalAuthBypassArguments,
} from "../src/infrastructure/config/local-development";
import {
  openLocalBypassDatabaseSession,
  type LocalBypassDatabaseSession,
} from "./local-bypass-database";
import {
  LocalBypassShutdownRequested,
  signalExitCode,
  waitForLocalBypassChildClose,
  watchLocalBypassShutdown,
  type LocalBypassShutdownWatcher,
} from "./local-bypass-signals";

const localBypassLockKey = "offerlab:local-auth-bypass";
const localBypassChildLockKey = `${localBypassLockKey}:child`;
const childSupervisorScript = fileURLToPath(
  new URL("./local-bypass-child-supervisor.ts", import.meta.url),
);

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

async function runNextDevelopmentServer(
  environment: NodeJS.ProcessEnv,
  port: string,
  databaseUrl: string,
  databaseSessionSignal: AbortSignal,
  shutdown: LocalBypassShutdownWatcher,
): Promise<number> {
  shutdown.throwIfRequested();
  if (databaseSessionSignal.aborted) {
    throw databaseSessionSignal.reason;
  }
  const child = spawn(process.execPath, ["--import", "tsx", childSupervisorScript], {
    detached: true,
    env: {
      ...environment,
      LOCAL_BYPASS_GUARDIAN_DATABASE_URL: databaseUrl,
      LOCAL_BYPASS_GUARDIAN_LOCK_KEY: localBypassChildLockKey,
      LOCAL_BYPASS_GUARDIAN_PORT: port,
    },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
  const childClosePromise = waitForLocalBypassChildClose(child);
  shutdown.attachChild(child);
  const stopChildAfterDatabaseSessionLoss = (): void => shutdown.stopChild("SIGTERM");
  databaseSessionSignal.addEventListener("abort", stopChildAfterDatabaseSessionLoss, {
    once: true,
  });
  if (databaseSessionSignal.aborted) stopChildAfterDatabaseSessionLoss();

  let childClose: Awaited<ReturnType<typeof waitForLocalBypassChildClose>>;
  try {
    childClose = await childClosePromise;
  } finally {
    databaseSessionSignal.removeEventListener("abort", stopChildAfterDatabaseSessionLoss);
    shutdown.detachChild(child);
  }
  const childErrors = [...childClose.errors, ...shutdown.forwardingFailures];
  childErrors.forEach((error) => {
    process.stderr.write(`Next.js development server supervisor error: ${error.message}\n`);
  });

  if (databaseSessionSignal.aborted) {
    throw databaseSessionSignal.reason;
  }
  if (shutdown.requestedSignal) {
    const childResult = childClose.signal
      ? `signal ${childClose.signal}`
      : `exit code ${childClose.code ?? "unknown"}`;
    process.stdout.write(
      `Local bypass shutdown forwarded ${shutdown.requestedSignal}; Next.js supervisor ended with ${childResult}.\n`,
    );
    return signalExitCode(shutdown.requestedSignal);
  }
  if (childErrors.length > 0) {
    throw new AggregateError(
      childErrors,
      "Next.js development server supervisor reported process errors before closing.",
    );
  }
  if (childClose.signal) {
    throw new Error(
      `Next.js development server supervisor stopped from signal ${childClose.signal}.`,
    );
  }
  if (childClose.code === null) {
    throw new Error("Next.js development server supervisor exited without an exit code or signal.");
  }
  if (childClose.code !== 0) {
    process.stderr.write(
      `Next.js development server supervisor exited with code ${childClose.code}.\n`,
    );
  }
  return childClose.code;
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

let launcherFailure: unknown;
let databaseSessionFailure: Error | undefined;
let databaseSession: LocalBypassDatabaseSession | null | undefined;
let promotedDeterministicUser = false;
const databaseSessionController = new AbortController();
const shutdown = watchLocalBypassShutdown(process, { escalationDelayMs: 20_000 });
try {
  databaseSession = await openLocalBypassDatabaseSession(databaseUrl, localBypassLockKey, () => {
    databaseSessionFailure ??= new Error(
      "The local bypass database session was lost; stopping Next.js because the launcher lock is no longer held.",
    );
    databaseSessionController.abort(databaseSessionFailure);
  });
  shutdown.throwIfRequested();
  if (!databaseSession) {
    throw new Error(
      "Another local bypass launcher is already running. Stop it before starting a new one.",
    );
  }
  const database = databaseSession.connection;
  const childLocks = await database<{ acquired: boolean }[]>`
    select pg_try_advisory_lock(hashtext(${localBypassChildLockKey})) as acquired
  `;
  if (!childLocks[0]?.acquired) {
    throw new Error(
      "Another local bypass launcher is already running. Stop it before starting a new one.",
    );
  }
  const releasedChildLocks = await database<{ released: boolean }[]>`
    select pg_advisory_unlock(hashtext(${localBypassChildLockKey})) as released
  `;
  if (!releasedChildLocks[0]?.released) {
    throw new Error("The local bypass child-lifetime lock probe could not be released.");
  }
  shutdown.throwIfRequested();

  let bypassUserId: string = localAuthBypassMember.userId;
  if (bypassRole === "administrator") {
    const administrators = await database<{ id: string }[]>`
      select id::text
      from app."user"
      where role = 'administrator'
        and id <> ${localAuthBypassMember.userId}::uuid
      limit 1
    `;
    shutdown.throwIfRequested();
    const existingAdministrator = administrators[0];
    if (existingAdministrator) {
      bypassUserId = existingAdministrator.id;
    } else {
      const rows = await database<{ available: boolean }[]>`
        select exists(
          select 1 from app."user" where id=${localAuthBypassMember.userId}::uuid
        ) as available
      `;
      shutdown.throwIfRequested();
      if (!rows[0]?.available) {
        throw new Error(
          "The local test member is missing. Run pnpm db:reset once, then try again.",
        );
      }
      await database`
        update app."user"
        set role = 'administrator', updated_at = now()
        where id = ${localAuthBypassMember.userId}::uuid
      `;
      promotedDeterministicUser = true;
      shutdown.throwIfRequested();
    }
  } else {
    const rows = await database<{ available: boolean }[]>`
      select exists(
        select 1 from app."user" where id=${localAuthBypassMember.userId}::uuid
      ) as available
    `;
    shutdown.throwIfRequested();
    if (!rows[0]?.available) {
      throw new Error("The local test member is missing. Run pnpm db:reset once, then try again.");
    }
    await database`
      update app."user"
      set role = 'member', updated_at = now()
      where id = ${localAuthBypassMember.userId}::uuid
    `;
    shutdown.throwIfRequested();
  }

  const port = process.env.PORT ?? "3000";
  if (!/^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/u.test(port)) {
    throw new Error("PORT must be between 1 and 65535.");
  }
  const appUrl = `http://127.0.0.1:${port}`;
  const accessPath = bypassRole === "administrator" ? "/admin" : "/member";
  const requestSecret = randomBytes(32).toString("hex");
  const accessUrl = new URL(accessPath, appUrl);
  accessUrl.searchParams.set("local-bypass-token", requestSecret);
  process.stdout.write(`Local test access enabled at ${accessUrl.toString()}\n`);

  process.exitCode = await runNextDevelopmentServer(
    {
      ...process.env,
      APP_ENV: "local",
      AUTH_RATE_LIMIT_SECRET:
        process.env.AUTH_RATE_LIMIT_SECRET ?? "local-bypass-rate-limit-secret",
      DATABASE_URL: roleDatabaseUrl(databaseUrl, "offerlab_runtime_login"),
      IDENTITY_SYNC_DATABASE_URL: roleDatabaseUrl(databaseUrl, "offerlab_identity_sync_login"),
      LOCAL_AUTH_BYPASS_ENABLED: "true",
      LOCAL_AUTH_BYPASS_REQUEST_SECRET: requestSecret,
      LOCAL_AUTH_BYPASS_ROLE: bypassRole,
      LOCAL_AUTH_BYPASS_USER_ID: bypassUserId,
      LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
      NEXT_PUBLIC_APP_URL: appUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NODE_ENV: "development",
    },
    port,
    databaseUrl,
    databaseSessionController.signal,
    shutdown,
  );
} catch (error) {
  if (error instanceof LocalBypassShutdownRequested) {
    process.exitCode = signalExitCode(error.signal);
  } else {
    launcherFailure = error;
  }
} finally {
  let restorationFailure: unknown;
  let connectionCloseFailure: unknown;
  try {
    if (promotedDeterministicUser && databaseSession && !databaseSessionFailure) {
      await databaseSession.connection`
        update app."user"
        set role = 'member', updated_at = now()
        where id = ${localAuthBypassMember.userId}::uuid
      `;
    }
  } catch (error) {
    restorationFailure = error;
  } finally {
    try {
      await databaseSession?.close();
    } catch (error) {
      connectionCloseFailure = error;
    } finally {
      shutdown.close();
    }
  }

  const failures = [
    ...new Set(
      [launcherFailure, databaseSessionFailure, restorationFailure, connectionCloseFailure].filter(
        (failure): failure is NonNullable<typeof failure> => failure !== undefined,
      ),
    ),
  ];
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      "The local bypass launcher failed and cleanup was incomplete.",
    );
  }
  if (shutdown.requestedSignal) {
    process.exitCode = signalExitCode(shutdown.requestedSignal);
  }
}
