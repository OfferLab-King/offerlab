import { describe, expect, it } from "vitest";

import {
  filterEmployerResearchRows,
  parseEmployerResearchFilters,
  type EmployerResearchViewRow,
} from "./employer-research-view";

function row(overrides: Partial<EmployerResearchViewRow> = {}): EmployerResearchViewRow {
  return {
    companyId: "c1",
    name: "Amazon",
    slug: "amazon",
    websiteUrl: "https://amazon.com",
    tier: "P0",
    employerValueScore: 90,
    crawlerPriorityScore: 80,
    sector: "Technology",
    employeeBand: "250,000+",
    ownership: "Listed parent/company",
    identityConfidence: "High",
    researchStatus: "verified_careers_url",
    researchDate: new Date("2026-08-12T00:00:00Z"),
    sponsorEntities: 1,
    sourceCandidates: 1,
    liveSources: 1,
    currentJobs: 5,
    atsProviders: "Custom branded careers",
    aliases: ["Amazon UK Services Ltd"],
    ...overrides,
  };
}

const rows = [
  row(),
  row({
    companyId: "c2",
    name: "Monzo",
    slug: "monzo",
    tier: "P1",
    sector: "Financial Services",
    employeeBand: "1,000–4,999",
    ownership: "Private company / subsidiary legal entity",
    identityConfidence: "High",
    researchStatus: "not_researched",
    liveSources: 1,
    currentJobs: 80,
    aliases: [],
  }),
  row({
    companyId: null,
    name: "BDO",
    slug: null,
    tier: "P0",
    identityConfidence: "Medium",
    researchStatus: "not_researched",
    ownership: "Private company / subsidiary legal entity",
    sponsorEntities: 0,
    sourceCandidates: 0,
    liveSources: 0,
    currentJobs: 0,
    aliases: [],
  }),
];

describe("parseEmployerResearchFilters", () => {
  it("parses tier, confidence, research status and toggles", () => {
    const filters = parseEmployerResearchFilters({
      tier: "p1",
      confidence: "Medium",
      research: "not_researched",
      live: "1",
      jobs: "1",
      candidate: "1",
      sponsor: "1",
      unresolved: "1",
      q: "  monzo  ",
    });
    expect(filters).toMatchObject({
      tier: "P1",
      identityConfidence: "Medium",
      researchStatus: "not_researched",
      hasLiveSource: true,
      hasJobs: true,
      hasSourceCandidate: true,
      hasSponsorEntity: true,
      unresolved: true,
      search: "monzo",
    });
  });

  it("parses sector, size and ownership filters", () => {
    const filters = parseEmployerResearchFilters({
      sector: "Financial Services",
      size: "1,000–4,999",
      ownership: "Private company / subsidiary legal entity",
    });
    expect(filters.sector).toBe("Financial Services");
    expect(filters.employeeBand).toBe("1,000–4,999");
    expect(filters.ownership).toBe("Private company / subsidiary legal entity");
  });

  it("ignores unknown values", () => {
    const filters = parseEmployerResearchFilters({ tier: "P9", confidence: "Unknown", q: "" });
    expect(filters.tier).toBeNull();
    expect(filters.identityConfidence).toBeNull();
    expect(filters.search).toBeNull();
  });
});

describe("filterEmployerResearchRows", () => {
  it("filters by tier", () => {
    const filtered = filterEmployerResearchRows(rows, {
      ...parseEmployerResearchFilters({ tier: "P1" }),
      tier: "P1",
    });
    expect(filtered.map((entry) => entry.name)).toEqual(["Monzo"]);
  });

  it("filters by sector", () => {
    const filtered = filterEmployerResearchRows(
      rows,
      parseEmployerResearchFilters({ sector: "Financial Services" }),
    );
    expect(filtered.map((entry) => entry.name)).toEqual(["Monzo"]);
  });

  it("filters by identity confidence", () => {
    const filtered = filterEmployerResearchRows(
      rows,
      parseEmployerResearchFilters({ confidence: "Medium" }),
    );
    expect(filtered.map((entry) => entry.name)).toEqual(["BDO"]);
  });

  it("filters by live source and jobs presence", () => {
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ live: "1" })).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Amazon", "Monzo"]);
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ jobs: "1" })),
    ).toHaveLength(2);
  });

  it("filters by size band, ownership and sponsor/candidate presence", () => {
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ size: "1,000–4,999" })).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Monzo"]);
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ sponsor: "1" })).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Amazon", "Monzo"]);
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ candidate: "1" })).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Amazon", "Monzo"]);
    expect(
      filterEmployerResearchRows(
        rows,
        parseEmployerResearchFilters({ ownership: "Listed parent/company" }),
      ).map((entry) => entry.name),
    ).toEqual(["Amazon"]);
  });

  it("isolates unresolved identities", () => {
    const filtered = filterEmployerResearchRows(
      rows,
      parseEmployerResearchFilters({ unresolved: "1" }),
    );
    expect(filtered.map((entry) => entry.name)).toEqual(["BDO"]);
  });

  it("searches across employer, alias and sponsor legal names", () => {
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ q: "amazon" })).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Amazon"]);
    expect(
      filterEmployerResearchRows(
        rows,
        parseEmployerResearchFilters({ q: "amazon uk services" }),
      ).map((entry) => entry.name),
    ).toEqual(["Amazon"]);
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ q: "monzo" })).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Monzo"]);
    expect(
      filterEmployerResearchRows(rows, parseEmployerResearchFilters({ q: "nonexistent" })),
    ).toHaveLength(0);
  });

  it("combines filters with AND semantics", () => {
    const filtered = filterEmployerResearchRows(rows, {
      ...parseEmployerResearchFilters({ tier: "P0", live: "1" }),
      tier: "P0",
    });
    expect(filtered.map((entry) => entry.name)).toEqual(["Amazon"]);
  });
});
