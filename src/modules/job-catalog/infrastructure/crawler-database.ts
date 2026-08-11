import postgres, { type Sql, type TransactionSql } from "postgres";

export function jsonParameter(database: TransactionSql, value: unknown) {
  return database.json(value as never);
}

let crawlerDatabase: Sql | undefined;

export function getCrawlerDatabase(): Sql {
  const databaseUrl =
    process.env.JOB_CRAWLER_DATABASE_URL ??
    (process.env.NODE_ENV === "production" ? undefined : process.env.DATABASE_MIGRATION_URL);
  if (!databaseUrl) {
    throw new Error("JOB_CRAWLER_DATABASE_URL is required for job catalog workers.");
  }
  crawlerDatabase ??= postgres(databaseUrl, { max: 3, prepare: false });
  return crawlerDatabase;
}

export async function closeCrawlerDatabase(): Promise<void> {
  if (crawlerDatabase) {
    await crawlerDatabase.end({ timeout: 5 });
    crawlerDatabase = undefined;
  }
}

export async function withCrawlerRole<T>(
  operation: (transaction: TransactionSql) => PromiseLike<T>,
): Promise<T> {
  return (await getCrawlerDatabase().begin(async (transaction) => {
    await transaction`set local role offerlab_crawler`;
    return await operation(transaction);
  })) as T;
}

export async function withCompanyCrawlLock<T>(
  companyId: string,
  operation: () => Promise<T>,
): Promise<Readonly<{ acquired: boolean; result: T | null }>> {
  return withAdvisoryLock(`offerlab.job_catalog.source.${companyId}`, operation);
}

export async function withGlobalCrawlLock<T>(
  lockKey: string,
  operation: () => Promise<T>,
): Promise<Readonly<{ acquired: boolean; result: T | null }>> {
  return withAdvisoryLock(`offerlab.job_catalog.${lockKey}`, operation);
}

async function withAdvisoryLock<T>(
  keyText: string,
  operation: () => Promise<T>,
): Promise<Readonly<{ acquired: boolean; result: T | null }>> {
  const connection = await getCrawlerDatabase().reserve();
  let acquired = false;
  try {
    const rows = await connection<{ acquired: boolean }[]>`
      select pg_try_advisory_lock(hashtextextended(${keyText}, 0)) as acquired
    `;
    acquired = rows[0]?.acquired === true;
    if (!acquired) return { acquired: false, result: null };
    return { acquired: true, result: await operation() };
  } finally {
    if (acquired) {
      await connection`select pg_advisory_unlock(hashtextextended(${keyText}, 0))`;
    }
    connection.release();
  }
}
