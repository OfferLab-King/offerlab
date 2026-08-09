import type { TransactionSql } from "postgres";

export type JobSearchUsageLimits = Readonly<{
  accountMonthly: number;
  memberDaily: number;
  memberMonthly: number;
}>;

export async function reserveJobSearchUsage(
  database: TransactionSql,
  owner: string,
  limits: JobSearchUsageLimits,
): Promise<boolean> {
  const rows = await database<{ reserved: boolean }[]>`
    select app.reserve_job_search_usage(
      ${owner}::uuid,
      ${limits.memberDaily}::integer,
      ${limits.memberMonthly}::integer,
      ${limits.accountMonthly}::integer
    ) reserved
  `;
  return rows[0]?.reserved ?? false;
}
