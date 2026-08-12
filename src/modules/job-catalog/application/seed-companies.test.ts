import { beforeEach, describe, expect, it, vi } from "vitest";

import { employerManifest, MANIFEST_VERSION } from "./employer-cohort";
import { directoryPriorityRankFor, jobSourceInputFor } from "./seed-companies";

function manifestCompany(slug: string) {
  const company = employerManifest.find((entry) => entry.slug === slug);
  if (!company) throw new Error(`manifest entry ${slug} missing`);
  return company;
}

describe("employer manifest integrity", () => {
  it("contains the full cohort with unique employer slugs and names", () => {
    const slugs = employerManifest.map((entry) => entry.slug);
    const names = employerManifest.map((entry) => entry.name);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(names).size).toBe(names.length);
    expect(employerManifest).toHaveLength(46);
  });

  it("derives unique gap-based directory priority ranks so manifest insertions never collide", () => {
    const ranks = employerManifest.map((_, index) => directoryPriorityRankFor(index));
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(Math.min(...ranks)).toBe(10);
    for (const rank of ranks) expect(rank % 10).toBe(0);
  });

  it("produces unique manifest source identities", () => {
    const identities = employerManifest.map((entry) => `${entry.slug}/all-careers`);
    expect(new Set(identities).size).toBe(identities.length);
  });

  it("records exactly the currently verified endpoints as verified", () => {
    const verified = employerManifest.filter((entry) => entry.verification.status === "verified");
    expect(verified.map((entry) => entry.slug).sort()).toEqual([
      "bank-of-america",
      "deutsche-bank",
      "dropbox",
      "duolingo",
      "instacart",
      "kpmg-uk",
      "monzo",
      "notion",
      "robinhood",
      "wise",
    ]);
  });

  it("marks every known-stale endpoint as stale with a dated reason", () => {
    const stale = employerManifest.filter((entry) => entry.verification.status === "stale");
    expect(stale.map((entry) => entry.slug).sort()).toEqual([
      "accenture",
      "arup",
      "asos",
      "bumble",
      "checkout-com",
      "deliveroo",
      "dentons",
      "iqvia",
      "national-grid",
      "pagegroup",
      "revolut",
      "save-the-children",
      "shopify",
      "sky",
      "skyscanner",
      "slalom",
      "thoughtworks",
    ]);
    for (const entry of stale) {
      expect(entry.verification.notes.length).toBeGreaterThan(0);
      expect(entry.verification.date).toMatch(/^2026-08-1[12]$/);
    }
  });

  it("keeps every unverified endpoint paused", () => {
    const unverified = employerManifest.filter(
      (entry) => entry.verification.status === "unverified",
    );
    expect(unverified).toHaveLength(19);
    for (const entry of unverified) {
      expect(jobSourceInputFor(entry, "00000000-0000-4000-8000-000000000001").status).toBe(
        "paused",
      );
    }
  });
});

describe("jobSourceInputFor", () => {
  it("activates only currently verified sources", () => {
    const input = jobSourceInputFor(
      manifestCompany("monzo"),
      "00000000-0000-4000-8000-000000000001",
    );
    expect(input.status).toBe("active");
    expect(input.slug).toBe("all-careers");
    expect(input.name).toBe("All careers");
    expect(input.verificationDate).toEqual(new Date("2026-08-12T00:00:00.000Z"));
    expect(input.manifestVersion).toBe(MANIFEST_VERSION);
  });

  it("pauses stale sources instead of activating them", () => {
    const input = jobSourceInputFor(
      manifestCompany("deliveroo"),
      "00000000-0000-4000-8000-000000000001",
    );
    expect(input.status).toBe("paused");
  });

  it("keeps Accenture paused until a valid public endpoint exists", () => {
    const accenture = manifestCompany("accenture");
    expect(accenture.verification.status).toBe("stale");
    expect(jobSourceInputFor(accenture, "00000000-0000-4000-8000-000000000001").status).toBe(
      "paused",
    );
  });
});

describe("seedInitialCohort", () => {
  beforeEach(() => vi.resetModules());

  it("imports verified sources active, stale sources paused, and is idempotent on reimport", async () => {
    const repository = await import("../infrastructure/job-source-repository");
    const companyRepository = await import("../infrastructure/company-repository");
    vi.spyOn(companyRepository, "upsertCompany").mockImplementation(
      async (_database, input) => `company-${input.slug}`,
    );
    const upsertSource = vi
      .spyOn(repository, "upsertJobSource")
      .mockImplementation(async () => "source-id");

    const { seedInitialCohort: seed } = await import("./seed-companies");
    const database = {} as never;
    await seed(database);
    const firstRun = upsertSource.mock.calls.map((call) => call[1]);

    expect(firstRun.find((input) => input.companyId === "company-monzo")?.status).toBe("active");
    expect(firstRun.find((input) => input.companyId === "company-deliveroo")?.status).toBe(
      "paused",
    );
    expect(firstRun.find((input) => input.companyId === "company-accenture")?.status).toBe(
      "paused",
    );
    expect(firstRun.find((input) => input.companyId === "company-bdo")?.status).toBe("paused");

    upsertSource.mockClear();
    await seed(database);
    const secondRun = upsertSource.mock.calls.map((call) => call[1]);
    expect(secondRun).toEqual(firstRun);
  });

  it("never forces an existing source back to active (status is preserved by the repository on reimport)", async () => {
    const repository = await import("../infrastructure/job-source-repository");
    const companyRepository = await import("../infrastructure/company-repository");
    vi.spyOn(companyRepository, "upsertCompany").mockImplementation(
      async (_database, input) => `company-${input.slug}`,
    );
    const upsertSource = vi
      .spyOn(repository, "upsertJobSource")
      .mockImplementation(async () => "source-id");

    const { seedInitialCohort: seed } = await import("./seed-companies");
    const database = {} as never;
    await seed(database);
    const calls = upsertSource.mock.calls.map((call) => call[1]);
    expect(calls).toHaveLength(employerManifest.length);
    expect(calls.every((input) => input.manuallyOverridden === undefined)).toBe(true);
  });
});
