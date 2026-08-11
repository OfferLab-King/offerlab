import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  jobSectorKeys,
  jobSectorLabel,
  jobSubsectorKeys,
  jobSubsectorLabel,
  jobSectors,
  jobSubsectors,
  opportunityTypes,
  opportunityTypeLabels,
  parseJobSectorKey,
  parseJobSubsectorKey,
  parseOpportunityType,
  subsectorSectorKey,
  subsectorsForSector,
} from "./taxonomy";

const migrationPath = fileURLToPath(
  new URL(
    "../../../../supabase/migrations/20260810163735_job_catalog_ia_eligibility.sql",
    import.meta.url,
  ),
);

function migrationSectorKeys(): string[] {
  const sql = readFileSync(migrationPath, "utf8");
  const section = sql.slice(
    sql.indexOf("insert into app.job_sector"),
    sql.indexOf("insert into app.job_subsector"),
  );
  return [...section.matchAll(/\('([a-z0-9_]+)',/gu)].map((match) => match[1]!);
}

function migrationSubsectorKeys(): string[] {
  const sql = readFileSync(migrationPath, "utf8");
  const section = sql.slice(
    sql.indexOf("insert into app.job_subsector"),
    sql.indexOf("alter table app.job"),
  );
  return [...section.matchAll(/\('([a-z0-9_]+)',/gu)].map((match) => match[1]!);
}

describe("sector taxonomy", () => {
  it("uses stable machine keys with unique display labels", () => {
    const keys = new Set(jobSectorKeys);
    expect(keys.size).toBe(jobSectorKeys.length);
    const labels = new Set(jobSectors.map((sector) => sector.displayName));
    expect(labels.size).toBe(jobSectors.length);
    for (const sector of jobSectors) {
      expect(sector.key).toMatch(/^[a-z0-9_]{2,60}$/u);
      expect(sector.displayName.length).toBeGreaterThan(0);
      expect(sector.description.length).toBeGreaterThan(0);
    }
  });

  it("matches the migration seed exactly", () => {
    expect([...jobSectorKeys].sort()).toEqual(migrationSectorKeys().sort());
  });

  it("parses known keys and rejects unknown ones", () => {
    expect(parseJobSectorKey("technology_it")).toBe("technology_it");
    expect(parseJobSectorKey("technology")).toBeNull();
    expect(jobSectorLabel("law")).toBe("Law");
    expect(jobSectorLabel("not-a-sector")).toBeNull();
  });
});

describe("subsector taxonomy", () => {
  it("uses stable keys with unique display labels", () => {
    expect(new Set(jobSubsectorKeys).size).toBe(jobSubsectorKeys.length);
    expect(new Set(jobSubsectors.map((subsector) => subsector.displayName)).size).toBe(
      jobSubsectors.length,
    );
  });

  it("matches the migration seed exactly", () => {
    expect([...jobSubsectorKeys].sort()).toEqual(migrationSubsectorKeys().sort());
  });

  it("maps every subsector except other to a known parent sector", () => {
    for (const subsector of jobSubsectors) {
      if (subsector.key === "other") {
        expect(subsector.sectorKey).toBeNull();
        continue;
      }
      expect(jobSectorKeys).toContain(subsector.sectorKey);
      expect(subsectorSectorKey(subsector.key)).toBe(subsector.sectorKey);
    }
  });

  it("lists subsectors per sector", () => {
    const consulting = subsectorsForSector("consulting");
    expect(consulting).toContain("management_consulting");
    expect(consulting).toContain("strategy_consulting");
    expect(subsectorsForSector("consulting")).not.toContain("audit");
    expect(jobSubsectorLabel("software_development")).toBe("Software Development");
    expect(jobSubsectorLabel("bogus")).toBeNull();
    expect(parseJobSubsectorKey("bogus")).toBeNull();
  });
});

describe("opportunity types", () => {
  it("covers the full early-career range", () => {
    for (const type of [
      "graduate_job",
      "graduate_scheme",
      "internship",
      "industrial_placement",
      "work_experience",
      "degree_apprenticeship",
      "apprenticeship",
      "immediate_start",
      "knowledge_transfer_partnership",
      "training_contract",
      "vacation_scheme",
      "volunteering",
      "entry_level",
      "junior",
      "postgraduate_opportunity",
      "other_early_career",
      "unknown",
    ]) {
      expect(opportunityTypes).toContain(type);
      expect(opportunityTypeLabels[type as keyof typeof opportunityTypeLabels]).toBeTruthy();
    }
  });

  it("parses known values and defaults to unknown", () => {
    expect(parseOpportunityType("internship")).toBe("internship");
    expect(parseOpportunityType("Internship")).toBe("unknown");
    expect(parseOpportunityType(null)).toBe("unknown");
  });
});
