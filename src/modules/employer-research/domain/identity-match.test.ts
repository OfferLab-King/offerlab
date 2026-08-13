import { describe, expect, it } from "vitest";

import {
  employerWebsiteCandidateUrl,
  isSharedAtsHostname,
  matchCanonicalEmployer,
  normalizeEmployerName,
  slugifyEmployerName,
  uniqueSlug,
} from "./identity-match";

const companies = [
  { id: "c1", name: "Monzo", slug: "monzo", websiteUrl: "https://monzo.com" },
  { id: "c2", name: "Wise", slug: "wise", websiteUrl: "https://wise.com" },
  { id: "c3", name: "Deutsche Bank", slug: "deutsche-bank", websiteUrl: null },
  { id: "c4", name: "KPMG UK", slug: "kpmg-uk", websiteUrl: "https://www.kpmg.com/uk" },
];

const aliases = [
  { alias: "J.P. Morgan", companyId: "c9" },
  { alias: "Amazon UK Services Ltd", companyId: "c10" },
];

describe("normalizeEmployerName", () => {
  it("strips legal suffixes and punctuation deterministically", () => {
    expect(normalizeEmployerName("Amazon UK Services Ltd")).toBe("amazon services");
    expect(normalizeEmployerName("Lloyds Banking Group plc")).toBe("lloyds banking");
    expect(normalizeEmployerName("HSBC Holdings plc")).toBe("hsbc");
    expect(normalizeEmployerName("Barclays")).toBe("barclays");
    expect(normalizeEmployerName("JPMorganChase")).toBe("jpmorganchase");
    expect(normalizeEmployerName("  The   Coca-Cola   Company  ")).toBe("coca cola");
  });

  it("keeps a usable stem when only legal words remain", () => {
    expect(normalizeEmployerName("The Group Ltd")).toBe("the group ltd");
  });
});

describe("slugifyEmployerName and uniqueSlug", () => {
  it("produces deterministic slugs", () => {
    expect(slugifyEmployerName("Lloyds Banking Group")).toBe("lloyds-banking-group");
    expect(slugifyEmployerName("JPMorganChase")).toBe("jpmorganchase");
    expect(uniqueSlug("Monzo", new Set(["monzo"]))).toBe("monzo-2");
    expect(uniqueSlug("Fresh", new Set(["fresh", "fresh-2"]))).toBe("fresh-3");
  });
});

describe("matchCanonicalEmployer", () => {
  it("matches exact normalized names", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "Monzo",
      existingCompanies: companies,
      existingAliases: aliases,
    });
    expect(match).toMatchObject({ companyId: "c1", grade: "exact" });
  });

  it("matches via slug", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "Deutsche Bank",
      existingCompanies: companies,
      existingAliases: aliases,
    });
    expect(match).toMatchObject({ companyId: "c3", grade: "exact" });
  });

  it("matches via alias", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "J.P. Morgan",
      existingCompanies: companies,
      existingAliases: aliases,
    });
    expect(match).toMatchObject({ companyId: "c9", grade: "alias" });
  });

  it("matches via website host", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "Wise Technology",
      existingCompanies: companies,
      existingAliases: aliases,
      evidenceWebsiteUrl: "https://wise.com/careers",
    });
    expect(match).toMatchObject({ companyId: "c2", grade: "website" });
  });

  it("never matches on shared multi-tenant ATS hosts", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "Wise Technology",
      existingCompanies: companies,
      existingAliases: aliases,
      evidenceWebsiteUrl: "https://boards.greenhouse.io/wise",
    });
    expect(match.grade).toBe("ambiguous");
    expect(match.companyId).toBeNull();
  });

  it("flags shared ATS hosts as non-website evidence", () => {
    expect(isSharedAtsHostname("boards.greenhouse.io")).toBe(true);
    expect(isSharedAtsHostname("jobs.lever.co")).toBe(true);
    expect(isSharedAtsHostname("barclays.wd3.myworkdayjobs.com")).toBe(true);
    expect(isSharedAtsHostname("wise.com")).toBe(false);
    expect(employerWebsiteCandidateUrl("https://jobs.ashbyhq.com/wise")).toBe(false);
    expect(employerWebsiteCandidateUrl("https://wise.com/careers")).toBe(true);
  });

  it("returns ambiguous with no company for unknown employers", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "Some Brand New Employer",
      existingCompanies: companies,
      existingAliases: aliases,
    });
    expect(match.companyId).toBeNull();
    expect(match.grade).toBe("ambiguous");
  });

  it("never fuzzily matches partially similar names", () => {
    const match = matchCanonicalEmployer({
      canonicalName: "Monzo Bank",
      existingCompanies: companies,
      existingAliases: aliases,
    });
    expect(match.grade).toBe("ambiguous");
    expect(match.companyId).toBeNull();
  });

  it.each([
    [
      "normalized names",
      {
        canonicalName: "Acme Ltd",
        existingAliases: [],
        existingCompanies: [
          { id: "n1", name: "Acme", slug: "acme-one", websiteUrl: null },
          { id: "n2", name: "Acme plc", slug: "acme-two", websiteUrl: null },
        ],
      },
    ],
    [
      "slugs",
      {
        canonicalName: "Target Brand",
        existingAliases: [],
        existingCompanies: [
          { id: "s1", name: "First Company", slug: "target-brand", websiteUrl: null },
          { id: "s2", name: "Second Company", slug: "target-brand", websiteUrl: null },
        ],
      },
    ],
    [
      "aliases",
      {
        canonicalName: "Shared Trading Name",
        existingAliases: [
          { alias: "Shared Trading Name", companyId: "a1" },
          { alias: "Shared Trading Name", companyId: "a2" },
        ],
        existingCompanies: [],
      },
    ],
    [
      "website hosts",
      {
        canonicalName: "Website Match",
        evidenceWebsiteUrl: "https://shared.example.com/careers",
        existingAliases: [],
        existingCompanies: [
          {
            id: "w1",
            name: "First Website Co",
            slug: "first-website",
            websiteUrl: "https://shared.example.com",
          },
          {
            id: "w2",
            name: "Second Website Co",
            slug: "second-website",
            websiteUrl: "https://shared.example.com/jobs",
          },
        ],
      },
    ],
  ] as const)("refuses multiple companies matching by %s", (_evidence, input) => {
    const match = matchCanonicalEmployer(input);
    expect(match).toMatchObject({ companyId: null, grade: "ambiguous" });
    expect(match.reason).toContain("multiple");
  });
});
