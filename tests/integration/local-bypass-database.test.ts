import postgres from "postgres";
import { afterEach, describe, expect, it } from "vitest";

import {
  openLocalBypassDatabaseSession,
  type LocalBypassDatabaseSession,
} from "../../scripts/local-bypass-database";

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
