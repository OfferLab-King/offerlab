import { describe, expect, it } from "vitest";

import {
  normalizeOptionalNumber,
  normalizeOptionalText,
  normalizeOptionalUrl,
  parsePriorityTier,
  parseYesNo,
  splitEvidenceUrls,
} from "./research-row";
import {
  parseWorkbookRow,
  sortByRank,
  validateParsedRows,
  validateWorkbookRows,
} from "./workbook-parse";

const baseRecord = {
  Rank: 1,
  "Priority Tier": "P0 – Must-have",
  "Canonical Employer": "Amazon",
  "Primary Sponsor Legal Entity": "Amazon UK Services Ltd",
  "Town/City": "London",
  "Identity Confidence": "High",
  "Employer Value Score": 94.83,
  "Crawler Readiness Score": 70,
  "Crawler Priority Score": 92.35,
  Sector: "Technology",
  Subsector: "Software / Internet / IT Services",
  "Employee Count": 1546000,
  "Employee Band": "250,000+",
  "Ownership / Listing": "Listed parent/company",
  "Skilled Worker Sponsor": "Yes",
  "Graduate Trainee Route": "Yes",
  "Career Search URL": "https://www.amazon.jobs/en-gb/",
  "ATS / Platform": "Custom branded careers",
  "ATS Verification Status": "Known official careers site",
  "Research Status": "Verified careers URL",
  "Evidence URLs": "https://www.gov.uk/register | https://targetjobs.co.uk",
  Notes: "  notes  ",
};

describe("workbook row parsing", () => {
  it("parses a full research row deterministically", () => {
    const row = parseWorkbookRow(baseRecord);
    expect(row).toMatchObject({
      rank: 1,
      priorityTier: "P0",
      canonicalEmployer: "Amazon",
      primarySponsorLegalEntity: "Amazon UK Services Ltd",
      townCity: "London",
      identityConfidence: "High",
      employerValueScore: 94.83,
      crawlerReadinessScore: 70,
      sector: "Technology",
      subsector: "Software / Internet / IT Services",
      employeeCount: 1546000,
      employeeBand: "250,000+",
      ownership: "Listed parent/company",
      skilledWorkerSponsor: true,
      graduateTraineeRoute: true,
      careerSearchUrl: "https://www.amazon.jobs/en-gb/",
      researchStatus: "verified_careers_url",
      notes: "notes",
    });
    expect(row.evidenceUrls).toEqual(["https://www.gov.uk/register", "https://targetjobs.co.uk"]);
    expect(parseWorkbookRow(baseRecord)).toEqual(row);
  });

  it("normalizes blanks, numbers and booleans", () => {
    const row = parseWorkbookRow({
      ...baseRecord,
      "Priority Tier": "",
      "Employee Count": "1,250",
      "Skilled Worker Sponsor": "No",
      "Current Jobs Observed": "42",
      Ticker: " AMZN ",
    });
    expect(row.priorityTier).toBe("P3");
    expect(row.employeeCount).toBe(1250);
    expect(row.skilledWorkerSponsor).toBe(false);
    expect(row.currentJobsObserved).toBe(42);
    expect(row.ticker).toBe("AMZN");
    expect(row.identityConfidence).toBe("High");
  });

  it("rejects invalid URLs when validating", () => {
    const records = [
      { ...baseRecord, Rank: 1, "Career Search URL": "not-a-url" },
      { ...baseRecord, Rank: 2, "Career Search URL": "ftp://x.example.com/jobs" },
      { ...baseRecord, Rank: 3, "Career Search URL": null },
    ];
    const outcome = validateWorkbookRows(records);
    expect(
      outcome.issues.filter(
        (issue) => issue.field === "Career Search URL" && issue.severity === "error",
      ),
    ).toHaveLength(2);
  });

  it("flags duplicate ranks and employers and invalid priority tiers", () => {
    const rows = [
      parseWorkbookRow(baseRecord),
      parseWorkbookRow(baseRecord),
      parseWorkbookRow({
        ...baseRecord,
        Rank: 4,
        "Priority Tier": "P5 – nope",
        "Identity Confidence": "Unknown",
      }),
    ];
    const issues = validateParsedRows(rows);
    const messages = issues.map((issue) => issue.message).join(" | ");
    expect(messages).toContain("Duplicate rank");
    expect(messages).toContain("Duplicate canonical employer");
    expect(messages).toContain("Unrecognised confidence");
  });

  it("validates the full 1000-row workbook shape", () => {
    const records = Array.from({ length: 1000 }, (_, index) => ({
      ...baseRecord,
      Rank: index + 1,
      "Canonical Employer": `Employer ${index}`,
    }));
    const outcome = validateWorkbookRows(records);
    expect(outcome.errorCount).toBe(0);
    expect(sortByRank(outcome.rows).map((row) => row.rank)).toEqual(
      Array.from({ length: 1000 }, (_, index) => index + 1),
    );
  });
});

describe("workbook scalar helpers", () => {
  it("parses priority tiers case-insensitively", () => {
    expect(parsePriorityTier("P0 – Must-have")).toBe("P0");
    expect(parsePriorityTier("p2")).toBe("P2");
    expect(parsePriorityTier(null)).toBeNull();
  });

  it("parses yes/no into booleans", () => {
    expect(parseYesNo("Yes")).toBe(true);
    expect(parseYesNo("no")).toBe(false);
    expect(parseYesNo("")).toBeNull();
  });

  it("splits evidence URLs on pipes/newlines/semicolons", () => {
    expect(
      splitEvidenceUrls(
        "https://a.example | https://b.example\nhttps://c.example; https://d.example",
      ),
    ).toEqual(["https://a.example", "https://b.example", "https://c.example", "https://d.example"]);
    expect(splitEvidenceUrls(null)).toEqual([]);
  });

  it("normalizes text, numbers and URLs", () => {
    expect(normalizeOptionalText("  x  ")).toBe("x");
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalNumber("12.5")).toBe(12.5);
    expect(normalizeOptionalNumber("nope")).toBeNull();
    expect(normalizeOptionalUrl(" https://x.example ")).toBe("https://x.example/");
    expect(normalizeOptionalUrl("not a url")).toBeNull();
  });
});
