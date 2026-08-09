import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobSearchProvider } from "../domain/job-search";
import { JobSearchUsageLimitError, readJobSearchUsageLimits, searchJobs } from "./search-jobs";

afterEach(() => vi.unstubAllEnvs());

describe("search jobs", () => {
  it("validates and normalizes member POST input before calling the provider", async () => {
    const provider: JobSearchProvider = {
      search: vi.fn(async () => ({ jobs: [], nextCursor: null })),
    };

    await expect(
      searchJobs(
        { location: " London ", remoteOnly: true, role: " Data   analyst " },
        { provider },
      ),
    ).resolves.toEqual({ jobs: [], nextCursor: null });
    expect(provider.search).toHaveBeenCalledWith({
      datePosted: "all",
      employmentTypes: [],
      jobRequirements: [],
      location: "London",
      remoteOnly: true,
      role: "Data analyst",
    });
  });

  it("does not call the provider for invalid POST input", async () => {
    const provider: JobSearchProvider = {
      search: vi.fn(async () => ({ jobs: [], nextCursor: null })),
    };

    await expect(searchJobs({ location: "London" }, { provider })).rejects.toThrow();
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("validates before reserving usage and calls the provider only after reservation", async () => {
    const order: string[] = [];
    const provider: JobSearchProvider = {
      search: vi.fn(async () => {
        order.push("provider");
        return { jobs: [], nextCursor: null };
      }),
    };
    const reserveUsage = vi.fn(async () => {
      order.push("reserve");
      return true;
    });

    await searchJobs(
      { location: "London", remoteOnly: false, role: "Graduate analyst" },
      { provider, reserveUsage },
    );

    expect(order).toEqual(["reserve", "provider"]);
  });

  it("stops before the provider when the member or account allowance is exhausted", async () => {
    const provider: JobSearchProvider = {
      search: vi.fn(async () => ({ jobs: [], nextCursor: null })),
    };

    await expect(
      searchJobs(
        { location: "London", remoteOnly: false, role: "Graduate analyst" },
        { provider, reserveUsage: async () => false },
      ),
    ).rejects.toBeInstanceOf(JobSearchUsageLimitError);
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("uses conservative defaults and accepts bounded operational overrides", () => {
    expect(readJobSearchUsageLimits()).toEqual({
      accountMonthly: 180,
      memberDaily: 10,
      memberMonthly: 20,
    });
    vi.stubEnv("JSEARCH_ACCOUNT_MONTHLY_LIMIT", "5000");
    vi.stubEnv("JSEARCH_MEMBER_DAILY_LIMIT", "25");
    vi.stubEnv("JSEARCH_MEMBER_MONTHLY_LIMIT", "100");
    expect(readJobSearchUsageLimits()).toEqual({
      accountMonthly: 5000,
      memberDaily: 25,
      memberMonthly: 100,
    });
    vi.stubEnv("JSEARCH_ACCOUNT_MONTHLY_LIMIT", "100001");
    expect(() => readJobSearchUsageLimits()).toThrow("job_discovery_usage_configuration_invalid");
  });
});
