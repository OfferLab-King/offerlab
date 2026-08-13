import { describe, expect, it } from "vitest";

import {
  employerDirectoryFilterAndSort,
  hasCredibleProfile,
  isEmployerDirectoryVisible,
  parseEmployerDirectoryFilters,
  type EmployerDirectoryEntry,
} from "./employer-directory";

function entry(overrides: Partial<EmployerDirectoryEntry> = {}): EmployerDirectoryEntry {
  return {
    id: "c1",
    slug: "acme",
    name: "Acme",
    logo_url: null,
    description: null,
    directory_visible: false,
    website_url: "https://acme.com",
    careers_url: null,
    employer_industry_key: "financial_services",
    employer_subindustry_key: null,
    employee_band: "10,000–49,999",
    employee_scope: "Global",
    ownership_type: "Listed parent/company",
    ticker: "ACME",
    exchange: "LSE",
    facts_as_of: new Date("2026-08-12T00:00:00Z"),
    has_sponsor: true,
    sponsor_snapshot_date: new Date("2026-08-12T00:00:00Z"),
    current_jobs: 3,
    live_sources: 1,
    ...overrides,
  };
}

describe("parseEmployerDirectoryFilters", () => {
  it("parses URL-backed filters", () => {
    const filters = parseEmployerDirectoryFilters({
      q: "  bank  ",
      industry: "financial_services",
      sponsor: "1",
      hiring: "1",
      size: "10,000–49,999",
      ownership: "Listed parent/company",
      sort: "roles",
      page: "1",
    });
    expect(filters.query).toBe("bank");
    expect(filters.industry).toBe("financial_services");
    expect(filters.sponsor).toBe(true);
    expect(filters.hiring).toBe(true);
    expect(filters.sort).toBe("roles");
  });

  it("defaults to hiring-first sorting and ignores unknown values", () => {
    const filters = parseEmployerDirectoryFilters({ sort: "bogus", industry: "nope" });
    expect(filters.sort).toBe("hiring");
    expect(filters.industry).toBe("nope");
  });
});

describe("isEmployerDirectoryVisible and hasCredibleProfile", () => {
  it("lists employers with current roles, curated visibility or credible profiles", () => {
    expect(isEmployerDirectoryVisible(entry())).toBe(true);
    expect(isEmployerDirectoryVisible(entry({ current_jobs: 0, directory_visible: true }))).toBe(
      true,
    );
    expect(
      isEmployerDirectoryVisible(
        entry({
          current_jobs: 0,
          directory_visible: false,
          employee_band: null,
          ownership_type: null,
          has_sponsor: false,
        }),
      ),
    ).toBe(false);
  });

  it("requires industry plus evidence and an official URL for a credible profile", () => {
    expect(hasCredibleProfile(entry())).toBe(true);
    expect(hasCredibleProfile(entry({ employer_industry_key: null }))).toBe(false);
    expect(
      hasCredibleProfile(entry({ employee_band: null, ownership_type: null, has_sponsor: false })),
    ).toBe(false);
    expect(hasCredibleProfile(entry({ website_url: null, careers_url: null }))).toBe(false);
  });

  it("never uses research tier or rank for visibility", () => {
    const thin = entry({
      current_jobs: 0,
      directory_visible: false,
      employee_band: null,
      ownership_type: null,
      has_sponsor: false,
    });
    expect(isEmployerDirectoryVisible({ ...thin })).toBe(false);
  });
});

describe("employerDirectoryFilterAndSort", () => {
  const rows = [
    entry({
      slug: "bank-a",
      name: "Bank A",
      current_jobs: 5,
      has_sponsor: true,
      employer_industry_key: "financial_services",
    }),
    entry({
      slug: "tech-b",
      name: "Tech B",
      current_jobs: 0,
      has_sponsor: false,
      employer_industry_key: "technology_software",
      employee_band: "1,000–4,999",
      website_url: null,
      careers_url: "https://techb.com/careers",
    }),
    entry({
      slug: "retail-c",
      name: "Retail C",
      current_jobs: 2,
      has_sponsor: true,
      employer_industry_key: "consumer_retail_fmcg",
    }),
  ];

  it("excludes non-visible employers", () => {
    const hidden = entry({
      slug: "hidden",
      name: "Hidden",
      current_jobs: 0,
      directory_visible: false,
      employee_band: null,
      ownership_type: null,
      has_sponsor: false,
    });
    const filtered = employerDirectoryFilterAndSort([...rows, hidden], {
      query: null,
      industry: null,
      sponsor: false,
      hiring: false,
      sizeBand: null,
      ownership: null,
      sort: "hiring",
      page: 1,
    });
    expect(filtered.map((row) => row.slug)).not.toContain("hidden");
  });

  it("filters by industry, sponsor, size and hiring", () => {
    expect(
      employerDirectoryFilterAndSort(rows, {
        query: null,
        industry: "financial_services",
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["bank-a"]);

    expect(
      employerDirectoryFilterAndSort(rows, {
        query: null,
        industry: null,
        sponsor: true,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["bank-a", "retail-c"]);

    expect(
      employerDirectoryFilterAndSort(rows, {
        query: null,
        industry: null,
        sponsor: false,
        hiring: true,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["bank-a", "retail-c"]);
  });

  it("sorts hiring-first, by roles, or alphabetically", () => {
    expect(
      employerDirectoryFilterAndSort(rows, {
        query: null,
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "hiring",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["bank-a", "retail-c", "tech-b"]);

    expect(
      employerDirectoryFilterAndSort(rows, {
        query: null,
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "roles",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["bank-a", "retail-c", "tech-b"]);

    expect(
      employerDirectoryFilterAndSort(rows, {
        query: null,
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["bank-a", "retail-c", "tech-b"]);
  });

  it("searches by employer name", () => {
    expect(
      employerDirectoryFilterAndSort(rows, {
        query: "tech",
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }).map((row) => row.slug),
    ).toEqual(["tech-b"]);
  });
});
