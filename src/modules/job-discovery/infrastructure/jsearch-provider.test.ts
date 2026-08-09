import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJobSearchRequest } from "../domain/job-search";
import {
  createJSearchProvider,
  JobDiscoveryProviderError,
  jsearchTimeoutMs,
} from "./jsearch-provider";

const validResponse = {
  data: {
    cursor: "next-page-cursor",
    jobs: [
      {
        apply_options: [
          {
            apply_link: "https://careers.example.com/jobs/graduate-developer",
            is_direct: true,
            publisher: " Example Careers ",
          },
        ],
        employer_name: " Example   Limited ",
        ignored_provider_field: "not exposed",
        job_apply_is_direct: false,
        job_apply_link: "https://jobs.example.net/apply/123",
        job_city: " London ",
        job_country: "gb",
        job_description: "  Build accessible products.\nWork with a delivery team.  ",
        job_employment_type: " Full-time ",
        job_employment_types: ["FULLTIME"],
        job_highlights: {
          Qualifications: [" TypeScript ", "", "Clear communication"],
        },
        job_id: "provider-job-123",
        job_is_remote: false,
        job_location: " London, UK ",
        job_max_salary: 35_000,
        job_min_salary: 30_000,
        job_posted_at: " 2 days ago ",
        job_posted_at_datetime_utc: "2026-08-05T09:30:00.000Z",
        job_publisher: " Example Jobs ",
        job_salary: " £30,000 - £35,000 a year ",
        job_salary_period: "YEAR",
        job_title: " Graduate   Developer ",
      },
    ],
  },
  parameters: { country: "gb", language: "en" },
  request_id: "synthetic-request-id",
  status: "OK",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function provider(fetchImplementation: typeof fetch, productionUseApproved = false) {
  return createJSearchProvider(
    {
      apiKey: "synthetic-test-key",
      appEnvironment: "test",
      productionUseApproved,
    },
    fetchImplementation,
  );
}

const searchInput = parseJobSearchRequest({
  cursor: "opaque-cursor",
  datePosted: "week",
  employmentTypes: ["FULLTIME", "INTERN"],
  jobRequirements: ["no_experience"],
  location: "London",
  radiusKm: 25,
  remoteOnly: true,
  role: "Graduate developer",
});

afterEach(() => {
  vi.useRealTimers();
});

describe("JSearch provider", () => {
  it("sends a server-only, quota-bounded UK search without caching", async () => {
    const fetchImplementation = vi.fn(async (...arguments_: Parameters<typeof fetch>) => {
      void arguments_;
      return jsonResponse(validResponse);
    });

    await provider(fetchImplementation as typeof fetch).search(searchInput);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchImplementation.mock.calls[0]!;
    const url = new URL(String(requestUrl));
    expect(`${url.origin}${url.pathname}`).toBe("https://api.openwebninja.com/jsearch/search-v2");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      country: "gb",
      cursor: "opaque-cursor",
      date_posted: "week",
      employment_types: "FULLTIME,INTERN",
      job_requirements: "no_experience",
      language: "en",
      num_pages: "1",
      query: "Graduate developer jobs in London",
      radius: "25",
      work_from_home: "true",
    });
    expect(url.searchParams.has("fields")).toBe(false);
    expect(url.toString()).not.toContain("synthetic-test-key");
    expect(requestInit).toMatchObject({
      cache: "no-store",
      headers: { accept: "application/json", "x-api-key": "synthetic-test-key" },
      method: "GET",
    });
    expect(requestInit?.body).toBeUndefined();
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("normalizes only validated fields and safe links", async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse(validResponse));

    const result = await provider(fetchImplementation as typeof fetch).search(searchInput);

    expect(result).toEqual({
      jobs: [
        {
          applyOptions: [
            {
              direct: true,
              publisher: "Example Careers",
              url: "https://careers.example.com/jobs/graduate-developer",
            },
          ],
          applyUrl: "https://jobs.example.net/apply/123",
          city: "London",
          country: "GB",
          description: "Build accessible products.\nWork with a delivery team.",
          directApply: false,
          employerName: "Example Limited",
          employmentType: "Full-time",
          employmentTypes: ["FULLTIME"],
          highlights: { Qualifications: ["TypeScript", "Clear communication"] },
          id: "provider-job-123",
          isRemote: false,
          location: "London, UK",
          postedAt: "2 days ago",
          postedAtUtc: "2026-08-05T09:30:00.000Z",
          publisher: "Example Jobs",
          salaryMaximum: 35_000,
          salaryMinimum: 30_000,
          salaryPeriod: "YEAR",
          salaryText: "£30,000 - £35,000 a year",
          title: "Graduate Developer",
        },
      ],
      nextCursor: "next-page-cursor",
    });
    expect(JSON.stringify(result)).not.toContain("ignored_provider_field");
  });

  it("rejects unsafe apply links and malformed provider envelopes", async () => {
    const unsafeResponse = structuredClone(validResponse);
    unsafeResponse.data.jobs[0]!.job_apply_link = "javascript:alert(1)";
    const unsafeFetch = vi.fn(async () => jsonResponse(unsafeResponse));
    await expect(provider(unsafeFetch as typeof fetch).search(searchInput)).rejects.toMatchObject({
      code: "job_discovery_provider_invalid_response",
    });

    const malformedFetch = vi.fn(async () => jsonResponse({ data: { jobs: [] }, status: "OK" }));
    await expect(
      provider(malformedFetch as typeof fetch).search(searchInput),
    ).rejects.toMatchObject({ code: "job_discovery_provider_invalid_response" });
  });

  it.each([
    [401, "job_discovery_provider_unauthorized"],
    [403, "job_discovery_provider_unauthorized"],
    [429, "job_discovery_provider_rate_limited"],
    [503, "job_discovery_provider_unavailable"],
  ] as const)("maps HTTP %i without reading or retrying provider content", async (status, code) => {
    const fetchImplementation = vi.fn(async () =>
      jsonResponse({ confidential: "ignored" }, status),
    );
    await expect(
      provider(fetchImplementation as typeof fetch).search(searchInput),
    ).rejects.toMatchObject({ code });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("aborts the provider request after twelve seconds", async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const request = provider(fetchImplementation as typeof fetch).search(searchInput);
    const assertion = expect(request).rejects.toMatchObject({
      code: "job_discovery_provider_timeout",
    });

    await vi.advanceTimersByTimeAsync(jsearchTimeoutMs);
    await assertion;
  });

  it("cannot be constructed for unapproved production use", () => {
    expect(() =>
      createJSearchProvider({
        apiKey: "synthetic-test-key",
        appEnvironment: "production",
        productionUseApproved: false,
      }),
    ).toThrowError(new JobDiscoveryProviderError("job_discovery_production_not_approved"));
  });
});
