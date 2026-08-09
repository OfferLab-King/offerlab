import "server-only";

import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  parseJobSearchRequest,
  type JobSearchProvider,
  type JobSearchResult,
} from "../domain/job-search";
import { reserveJobSearchUsage } from "../infrastructure/search-usage-repository";

export type SearchJobsDependencies = Readonly<{
  provider: JobSearchProvider;
  reserveUsage?: () => Promise<boolean>;
}>;

export class JobSearchUsageLimitError extends Error {
  public constructor() {
    super("job_discovery_usage_limit_reached");
    this.name = "JobSearchUsageLimitError";
  }
}

const defaultUsageLimits = {
  accountMonthly: 180,
  memberDaily: 10,
  memberMonthly: 20,
} as const;

function usageLimit(
  name:
    "JSEARCH_ACCOUNT_MONTHLY_LIMIT" | "JSEARCH_MEMBER_DAILY_LIMIT" | "JSEARCH_MEMBER_MONTHLY_LIMIT",
  fallback: number,
): number {
  const value = process.env[name];
  if (!value) return fallback;
  if (!/^(?:[1-9]\d{0,4}|100000)$/u.test(value)) {
    throw new Error("job_discovery_usage_configuration_invalid");
  }
  return Number(value);
}

export function readJobSearchUsageLimits() {
  return {
    accountMonthly: usageLimit("JSEARCH_ACCOUNT_MONTHLY_LIMIT", defaultUsageLimits.accountMonthly),
    memberDaily: usageLimit("JSEARCH_MEMBER_DAILY_LIMIT", defaultUsageLimits.memberDaily),
    memberMonthly: usageLimit("JSEARCH_MEMBER_MONTHLY_LIMIT", defaultUsageLimits.memberMonthly),
  } as const;
}

export async function searchJobs(
  input: unknown,
  dependencies: SearchJobsDependencies,
): Promise<JobSearchResult> {
  const request = parseJobSearchRequest(input);
  if (dependencies.reserveUsage && !(await dependencies.reserveUsage())) {
    throw new JobSearchUsageLimitError();
  }
  return dependencies.provider.search(request);
}

export function searchJobsForMember(
  owner: string,
  input: unknown,
  dependencies: Readonly<{ provider: JobSearchProvider }>,
): Promise<JobSearchResult> {
  const limits = readJobSearchUsageLimits();
  return searchJobs(input, {
    provider: dependencies.provider,
    reserveUsage: () =>
      withApplicationUser(owner, (database) => reserveJobSearchUsage(database, owner, limits)),
  });
}
