import postgres, { type ReservedSql } from "postgres";

export type LocalBypassDatabaseSession = Readonly<{
  connection: ReservedSql;
  close: () => Promise<void>;
}>;

export async function openLocalBypassDatabaseSession(
  databaseUrl: string,
  lockKey: string,
  onSessionLost: () => void = () => undefined,
): Promise<LocalBypassDatabaseSession | null> {
  let closing = false;
  let reservationActive = false;
  let sessionLost = false;
  const database = postgres(databaseUrl, {
    max: 1,
    max_lifetime: null,
    onclose: () => {
      if (!closing && reservationActive && !sessionLost) {
        sessionLost = true;
        onSessionLost();
      }
    },
    prepare: false,
  });
  let connection: ReservedSql | undefined;
  let lockAcquired = false;
  let closePromise: Promise<void> | undefined;

  const close = (): Promise<void> => {
    closePromise ??= closeSession();
    return closePromise;
  };

  const closeSession = async (): Promise<void> => {
    closing = true;
    const failures: unknown[] = [];
    if (connection && lockAcquired && !sessionLost) {
      try {
        const rows = await connection<{ released: boolean }[]>`
          select pg_advisory_unlock(hashtext(${lockKey})) as released
        `;
        if (!rows[0]?.released) {
          throw new Error("The local bypass advisory lock was no longer owned during cleanup.");
        }
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      connection?.release();
    } catch (error) {
      failures.push(error);
    }
    try {
      await database.end({ timeout: 5 });
    } catch (error) {
      failures.push(error);
    }

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        "The local bypass database session did not close cleanly.",
      );
    }
  };

  try {
    connection = await database.reserve();
    reservationActive = true;
    const locks = await connection<{ acquired: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${lockKey})) as acquired
    `;
    lockAcquired = locks[0]?.acquired === true;
    if (!lockAcquired) {
      await close();
      return null;
    }
    return { connection, close };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "The local bypass database session failed to open and close cleanly.",
      );
    }
    throw error;
  }
}
