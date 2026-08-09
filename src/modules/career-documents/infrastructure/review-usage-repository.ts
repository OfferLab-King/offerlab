import type { TransactionSql } from "postgres";

export type CareerDocumentReviewUsageLimits = Readonly<{
  hostedAccountMonthly: number;
  memberDaily: number;
  memberMonthly: number;
}>;

export async function reserveCareerDocumentReviewUsage(
  database: TransactionSql,
  owner: string,
  modelRequested: boolean,
  limits: CareerDocumentReviewUsageLimits,
): Promise<boolean> {
  const rows = await database<{ reserved: boolean }[]>`
    select app.reserve_career_document_review_usage(
      ${owner}::uuid,
      ${modelRequested}::boolean,
      ${limits.memberDaily}::integer,
      ${limits.memberMonthly}::integer,
      ${limits.hostedAccountMonthly}::integer
    ) reserved
  `;
  return rows[0]?.reserved ?? false;
}
