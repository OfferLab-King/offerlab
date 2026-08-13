import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  openLocalBypassDatabaseSession,
  type LocalBypassDatabaseSession,
} from "../../scripts/local-bypass-database";
import { isLoopbackUrl } from "../../src/infrastructure/config/local-development";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const lockKey = `offerlab:local-auth-bypass:test:${process.pid}`;
const originalMaximumLifetime = process.env.PGMAX_LIFETIME;
const openSessions = new Set<LocalBypassDatabaseSession>();

afterEach(async () => {
  await Promise.all([...openSessions].map((session) => session.close()));
  openSessions.clear();
  if (originalMaximumLifetime === undefined) {
    delete process.env.PGMAX_LIFETIME;
  } else {
    process.env.PGMAX_LIFETIME = originalMaximumLifetime;
  }
});

describe("local bypass database session", () => {
  it("holds one backend and advisory lock until the reserved session closes", async () => {
    process.env.PGMAX_LIFETIME = "1";
    const firstSession = await openLocalBypassDatabaseSession(databaseUrl, lockKey);
    expect(firstSession).not.toBeNull();
    if (!firstSession) throw new Error("Expected the first session to acquire the lock.");
    openSessions.add(firstSession);

    const initialRows = await firstSession.connection<{ pid: number }[]>`
      select pg_backend_pid() as pid
    `;
    await new Promise((resolve) => setTimeout(resolve, 1_300));
    const laterRows = await firstSession.connection<{ pid: number }[]>`
      select pg_backend_pid() as pid
    `;
    const competingSession = await openLocalBypassDatabaseSession(databaseUrl, lockKey);

    expect(laterRows[0]?.pid).toBe(initialRows[0]?.pid);
    expect(competingSession).toBeNull();

    await firstSession.close();
    openSessions.delete(firstSession);
    const nextSession = await openLocalBypassDatabaseSession(databaseUrl, lockKey);
    expect(nextSession).not.toBeNull();
    if (nextSession) openSessions.add(nextSession);
  });

  it("reports unexpected loss of the reserved backend", async () => {
    let reportSessionLoss: (() => void) | undefined;
    const sessionLoss = new Promise<void>((resolve) => {
      reportSessionLoss = resolve;
    });
    const session = await openLocalBypassDatabaseSession(databaseUrl, `${lockKey}:loss`, () =>
      reportSessionLoss?.(),
    );
    expect(session).not.toBeNull();
    if (!session) throw new Error("Expected the session to acquire the lock.");
    openSessions.add(session);
    const observer = postgres(databaseUrl, { max: 1, prepare: false });

    try {
      const rows = await session.connection<{ pid: number }[]>`select pg_backend_pid() as pid`;
      const backendPid = rows[0]?.pid;
      expect(backendPid).toBeTypeOf("number");
      if (backendPid === undefined) throw new Error("Expected the reserved backend PID.");
      await observer`select pg_terminate_backend(${backendPid})`;

      await expect(
        Promise.race([
          sessionLoss,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Session loss was not reported.")), 2_000),
          ),
        ]),
      ).resolves.toBeUndefined();
    } finally {
      await observer.end({ timeout: 2 });
    }
  });
});

const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fakePnpmDirectory = join(repositoryRoot, "tests", "fixtures", "local-bypass");
const launcherScript = join(repositoryRoot, "scripts", "run-local-bypass.ts");
const deterministicUserId = "20000000-0000-4000-8000-000000000003";
const launcherLockKey = "offerlab:local-auth-bypass";

type Launcher = Readonly<{
  childPidFile: string;
  process: ChildProcess;
  readStderr: () => string;
}>;

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  message: string,
  timeoutMs = 4_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function allocatePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP test address.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function readChildPid(path: string): Promise<number | undefined> {
  try {
    const pid = Number((await readFile(path, "utf8")).trim());
    return Number.isInteger(pid) ? pid : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function waitForHttp(port: number): Promise<void> {
  await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(150),
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }, `The fake Next.js server on port ${port} did not become ready.`);
}

async function waitForExit(
  child: ChildProcess,
  timeoutMs = 4_000,
): Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return Promise.race([
    once(child, "exit").then(([code, signal]) => ({
      code: code as number | null,
      signal: signal as NodeJS.Signals | null,
    })),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The launcher did not exit in time.")), timeoutMs),
    ),
  ]);
}

function disposableDatabaseRootUrl(
  value: string,
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
): URL {
  const url = new URL(value);
  if (
    nodeEnvironment !== "test" ||
    !isLoopbackUrl(value) ||
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
  ) {
    throw new Error(
      "Disposable local bypass tests require NODE_ENV=test and a loopback PostgreSQL URL.",
    );
  }
  url.pathname = "/postgres";
  return url;
}

describe("composed local bypass launcher lifecycle", () => {
  const rootDatabaseUrl = disposableDatabaseRootUrl(databaseUrl);
  const disposableDatabaseName = `offerlab_bypass_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const disposableDatabaseUrl = new URL(rootDatabaseUrl);
  disposableDatabaseUrl.pathname = `/${disposableDatabaseName}`;
  const administrator = postgres(rootDatabaseUrl.toString(), { max: 1, prepare: false });
  let database: ReturnType<typeof postgres>;
  let temporaryDirectory: string;
  let launcherSequence = 0;
  const launchers = new Set<Launcher>();

  const startLauncher = async (
    role: "administrator" | "member",
    port: number,
    shutdownDelayMs = 0,
  ): Promise<Launcher> => {
    const childPidFile = join(temporaryDirectory, `child-${launcherSequence++}.pid`);
    const output = { stderr: "" };
    const child = spawn(
      process.execPath,
      ["--import", "tsx", launcherScript, ...(role === "administrator" ? ["--admin"] : [])],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          LOCAL_BYPASS_TEST_CHILD_PID_FILE: childPidFile,
          LOCAL_BYPASS_TEST_DATABASE_URL: disposableDatabaseUrl.toString(),
          LOCAL_BYPASS_TEST_SHUTDOWN_DELAY_MS: String(shutdownDelayMs),
          PATH: `${fakePnpmDirectory}${delimiter}${process.env.PATH ?? ""}`,
          PORT: String(port),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stderr?.on("data", (chunk: Buffer) => {
      output.stderr += chunk.toString("utf8");
    });
    const launcher = { childPidFile, process: child, readStderr: () => output.stderr };
    launchers.add(launcher);
    return launcher;
  };

  const stopLauncher = async (launcher: Launcher): Promise<void> => {
    if (
      launcher.process.pid &&
      launcher.process.exitCode === null &&
      !launcher.process.signalCode
    ) {
      launcher.process.kill("SIGTERM");
      try {
        await waitForExit(launcher.process, 2_000);
      } catch {
        launcher.process.kill("SIGKILL");
        await waitForExit(launcher.process, 2_000).catch(() => undefined);
      }
    }
    const childPid = await readChildPid(launcher.childPidFile);
    if (childPid && processIsAlive(childPid)) {
      try {
        process.kill(-childPid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    launchers.delete(launcher);
  };

  const readDeterministicRole = async (): Promise<string | undefined> => {
    const rows = await database<{ role: string }[]>`
      select role from app."user" where id = ${deterministicUserId}::uuid
    `;
    return rows[0]?.role;
  };

  it("rejects remote database targets before creating a disposable fixture", () => {
    expect(() =>
      disposableDatabaseRootUrl("postgresql://postgres:secret@staging.example/offerlab"),
    ).toThrow("loopback PostgreSQL URL");
    expect(() => disposableDatabaseRootUrl(databaseUrl, "production")).toThrow("NODE_ENV=test");
  });

  beforeAll(async () => {
    await administrator.unsafe(`create database "${disposableDatabaseName}" template template0`);
    database = postgres(disposableDatabaseUrl.toString(), { max: 3, prepare: false });
    await database.unsafe(`
      create schema app;
      create table app."user" (
        id uuid primary key,
        role text not null,
        updated_at timestamptz not null default now()
      )
    `);
    temporaryDirectory = await mkdtemp(join(tmpdir(), "offerlab-local-bypass-"));
  });

  beforeEach(async () => {
    await database`truncate app."user"`;
    await database`
      insert into app."user" (id, role)
      values (${deterministicUserId}::uuid, 'member')
    `;
  });

  afterEach(async () => {
    await Promise.all([...launchers].map((launcher) => stopLauncher(launcher)));
  });

  afterAll(async () => {
    await database.end({ timeout: 2 });
    await administrator.unsafe(`drop database if exists "${disposableDatabaseName}" with (force)`);
    await administrator.end({ timeout: 2 });
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  it("restores a fallback administrator after SIGINT and rejects a concurrent child", async () => {
    const firstPort = await allocatePort();
    const first = await startLauncher("administrator", firstPort);
    await waitForHttp(firstPort);
    expect(await readDeterministicRole()).toBe("administrator");

    const contender = await startLauncher("member", await allocatePort());
    await expect(waitForExit(contender.process)).resolves.toEqual({ code: 1, signal: null });
    expect(contender.readStderr()).toContain("Another local bypass launcher is already running");
    expect(await readChildPid(contender.childPidFile)).toBeUndefined();

    first.process.kill("SIGINT");
    await expect(waitForExit(first.process)).resolves.toEqual({ code: 130, signal: null });
    const firstChildPid = await readChildPid(first.childPidFile);
    expect(firstChildPid).toBeDefined();
    if (firstChildPid) expect(processIsAlive(firstChildPid)).toBe(false);
    expect(await readDeterministicRole()).toBe("member");

    const nextPort = await allocatePort();
    const next = await startLauncher("member", nextPort);
    await waitForHttp(nextPort);
    next.process.kill("SIGINT");
    await expect(waitForExit(next.process)).resolves.toEqual({ code: 130, signal: null });
  });

  it("stops the child after backend loss and lets member mode repair fallback state", async () => {
    const firstPort = await allocatePort();
    const first = await startLauncher("administrator", firstPort);
    await waitForHttp(firstPort);
    expect(await readDeterministicRole()).toBe("administrator");
    const lockRows = await database<{ pid: number }[]>`
      select pid
      from pg_locks
      where locktype = 'advisory'
        and granted
        and database = (select oid from pg_database where datname = current_database())
        and objid::bigint = hashtext(${launcherLockKey})::bigint
    `;
    expect(lockRows).toHaveLength(1);
    const launcherBackendPid = lockRows[0]?.pid;
    if (launcherBackendPid === undefined) throw new Error("Expected the launcher backend PID.");
    await database`select pg_terminate_backend(${launcherBackendPid})`;

    await expect(waitForExit(first.process)).resolves.toEqual({ code: 1, signal: null });
    const firstChildPid = await readChildPid(first.childPidFile);
    expect(firstChildPid).toBeDefined();
    if (firstChildPid) expect(processIsAlive(firstChildPid)).toBe(false);
    expect(await readDeterministicRole()).toBe("administrator");

    const recoveryPort = await allocatePort();
    const recovery = await startLauncher("member", recoveryPort);
    await waitForHttp(recoveryPort);
    expect(await readDeterministicRole()).toBe("member");
    recovery.process.kill("SIGINT");
    await expect(waitForExit(recovery.process)).resolves.toEqual({ code: 130, signal: null });
  });

  it("keeps the lock while stopping Next after an abrupt launcher death, then permits reuse", async () => {
    const firstPort = await allocatePort();
    const first = await startLauncher("administrator", firstPort, 750);
    await waitForHttp(firstPort);
    const firstChildPid = await readChildPid(first.childPidFile);
    expect(firstChildPid).toBeDefined();
    if (!first.process.pid || !firstChildPid) throw new Error("Expected launcher and child PIDs.");

    process.kill(first.process.pid, "SIGKILL");
    await expect(waitForExit(first.process)).resolves.toEqual({ code: null, signal: "SIGKILL" });
    expect(processIsAlive(firstChildPid)).toBe(true);

    const contender = await startLauncher("member", await allocatePort());
    await expect(waitForExit(contender.process)).resolves.toEqual({ code: 1, signal: null });
    expect(contender.readStderr()).toContain("Another local bypass launcher is already running");
    expect(await readChildPid(contender.childPidFile)).toBeUndefined();

    await waitFor(
      () => !processIsAlive(firstChildPid),
      "The fake Next.js process survived its launcher.",
    );
    const nextPort = await allocatePort();
    const next = await startLauncher("member", nextPort);
    await waitForHttp(nextPort);
    expect(await readDeterministicRole()).toBe("member");
    next.process.kill("SIGINT");
    await expect(waitForExit(next.process)).resolves.toEqual({ code: 130, signal: null });
  });
});
