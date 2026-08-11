import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  buildJobFilterClauses,
  defaultJobCatalogFilters,
  filtersToSearchParams,
  keyToSlug,
  parseJobCatalogFilters,
  serializeJobCatalogFilters,
  slugToKey,
  splitLocationSelections,
} from "./catalog";

describe("catalog URL serialisation", () => {
  it("round-trips a full faceted filter set through slug parameters", () => {
    const filters = {
      ...defaultJobCatalogFilters,
      employers: ["monzo", "notion"],
      jobTypes: ["graduate_job", "internship"],
      locations: ["london", "remote"],
      query: "analyst",
      sectors: ["financial_services", "technology_it"],
      sponsorship: ["confirmed"],
      subsectors: ["software_development"],
    };
    const parsed = parseJobCatalogFilters(new URLSearchParams(filtersToSearchParams(filters)));
    expect(parsed).toEqual(filters);
  });

  it("uses stable slug parameters, not display labels or raw keys", () => {
    const params = serializeJobCatalogFilters({
      ...defaultJobCatalogFilters,
      sectors: ["financial_services"],
      jobTypes: ["graduate_job"],
    });
    expect(params.get("sectors")).toBe("financial-services");
    expect(params.get("job_types")).toBe("graduate-job");
    expect(keyToSlug("investment_banking_asset_management")).toBe(
      "investment-banking-asset-management",
    );
    expect(slugToKey("investment-banking-asset-management")).toBe(
      "investment_banking_asset_management",
    );
  });

  it("drops invalid sector and job-type slugs", () => {
    const parsed = parseJobCatalogFilters(
      new URLSearchParams({ job_types: "graduate-job,not-a-type", sectors: "law,not-a-sector" }),
    );
    expect(parsed.jobTypes).toEqual(["graduate_job"]);
    expect(parsed.sectors).toEqual(["law"]);
  });

  it("supports repeated and comma-separated parameters", () => {
    const parsed = parseJobCatalogFilters(
      new URLSearchParams([
        ["employers", "monzo,notion"],
        ["locations", "london"],
        ["locations", "remote"],
      ]),
    );
    expect(parsed.employers).toEqual(["monzo", "notion"]);
    expect(parsed.locations).toEqual(["london", "remote"]);
  });

  it("normalises location values and resets page on default", () => {
    const parsed = parseJobCatalogFilters(new URLSearchParams({ locations: "LONDON" }));
    expect(parsed.locations).toEqual(["london"]);
    expect(parseJobCatalogFilters(new URLSearchParams({ page: "999999" })).page).toBe(1);
  });

  it("counts active facets for the mobile filter button", () => {
    expect(activeFilterCount(defaultJobCatalogFilters)).toBe(0);
    expect(
      activeFilterCount({ ...defaultJobCatalogFilters, sectors: ["law"], locations: ["london"] }),
    ).toBe(2);
  });
});

describe("faceted filter clause semantics", () => {
  const buildFor = (
    overrides: Partial<Parameters<typeof buildJobFilterClauses>[0]>,
    options?: Parameters<typeof buildJobFilterClauses>[2],
  ): Readonly<{ conditions: string[]; values: unknown[] }> => {
    const result = buildJobFilterClauses(
      { ...defaultJobCatalogFilters, ...overrides },
      new Date("2026-08-01T00:00:00Z"),
      options,
    );
    return result;
  };

  it("combines selections inside one facet with OR", () => {
    const { conditions } = buildFor({ sectors: ["law", "consulting"] });
    expect(conditions.join(" and ")).toContain("j.sector_key = any(");
  });

  it("combines different facets with AND", () => {
    const { conditions } = buildFor({ jobTypes: ["graduate_job"], sectors: ["law"] });
    expect(conditions.length).toBe(2);
    expect(conditions.join(" and ")).toContain("opportunity_type");
    expect(conditions.join(" and ")).toContain("sector_key");
  });

  it("applies keyword search alongside every facet", () => {
    const { conditions } = buildFor({ query: "analyst", sectors: ["law"] });
    expect(conditions.length).toBe(2);
    expect(conditions[0]).toContain("search_vector");
  });

  it("excludes only its own facet for disjunctive counts", () => {
    const all = buildFor({ sectors: ["law"], jobTypes: ["graduate_job"] });
    const sectorCount = buildFor(
      { sectors: ["law"], jobTypes: ["graduate_job"] },
      { excludeFacet: "sectors" },
    );
    expect(sectorCount.conditions.some((c) => c.includes("sector_key"))).toBe(false);
    expect(sectorCount.conditions.some((c) => c.includes("opportunity_type"))).toBe(true);
    expect(all.conditions.some((c) => c.includes("sector_key"))).toBe(true);
  });

  it("includes descendant subsectors when a sector is selected without subsectors", () => {
    const { conditions } = buildFor({ sectors: ["law"] });
    expect(conditions.some((c) => c.includes("sector_key = any"))).toBe(true);
    expect(conditions.some((c) => c.includes("subsector_key"))).toBe(false);
  });

  it("filters by subsector when subsectors are selected", () => {
    const { conditions } = buildFor({ subsectors: ["commercial_law"] });
    expect(conditions.some((c) => c.includes("subsector_key = any"))).toBe(true);
    expect(conditions.some((c) => c.includes("j.sector_key = any"))).toBe(false);
  });

  it("matches work modes and city labels from the locations facet", () => {
    const { conditions, values } = buildFor({ locations: ["london", "remote"] });
    const joined = conditions.join(" ");
    expect(joined).toContain("remote_type");
    expect(joined).toContain("job_location");
    expect(values.some((value) => Array.isArray(value) && value.includes("london"))).toBe(true);
    expect(values.some((value) => Array.isArray(value) && value.includes("remote"))).toBe(true);
  });

  it("splits locations into work modes and city labels", () => {
    expect(splitLocationSelections(["london", "remote", "Hybrid"])).toEqual({
      labels: ["london"],
      modes: ["remote", "hybrid"],
    });
  });

  it("applies deadline and posted-within constraints", () => {
    const { conditions } = buildFor({ deadline: "upcoming", postedWithinDays: 7 });
    expect(conditions.some((c) => c.includes("application_deadline"))).toBe(true);
    expect(conditions.some((c) => c.includes("first_seen_at"))).toBe(true);
  });
});
