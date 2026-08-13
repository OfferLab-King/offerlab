import { describe, expect, it } from "vitest";

import {
  atsPlatformFromResearchText,
  fingerprintCareersUrl,
  sourceTypeForPlatform,
} from "./ats-fingerprint";

describe("fingerprintCareersUrl", () => {
  it("fingerprints Workday tenants with high confidence", () => {
    expect(fingerprintCareersUrl("https://barclays.wd3.myworkdayjobs.com/careers")).toMatchObject({
      platform: "workday",
      confidence: "high",
    });
    expect(
      fingerprintCareersUrl("https://lbg.wd3.myworkdayjobs.com/LloydsBankingGroup/"),
    ).toMatchObject({
      platform: "workday",
    });
    expect(fingerprintCareersUrl("https://acme.myworkdayjobs.com/careers")).toMatchObject({
      platform: "workday",
    });
    expect(fingerprintCareersUrl("https://acme.myworkday.com/careers")).toMatchObject({
      platform: "workday",
    });
  });

  it("fingerprints native ATS board hosts", () => {
    expect(fingerprintCareersUrl("https://boards.greenhouse.io/monzo")).toMatchObject({
      platform: "greenhouse",
      confidence: "high",
    });
    expect(fingerprintCareersUrl("https://boards.eu.greenhouse.io/wise")).toMatchObject({
      platform: "greenhouse",
    });
    expect(fingerprintCareersUrl("https://grnh.se/abc123")).toMatchObject({
      platform: "greenhouse",
    });
    expect(fingerprintCareersUrl("https://jobs.lever.co/acme/role")).toMatchObject({
      platform: "lever",
    });
    expect(fingerprintCareersUrl("https://jobs.ashbyhq.com/acme")).toMatchObject({
      platform: "ashby",
    });
    expect(fingerprintCareersUrl("https://jobs.smartrecruiters.com/Acme/")).toMatchObject({
      platform: "smartrecruiters",
    });
  });

  it("fingerprints enterprise platforms", () => {
    expect(fingerprintCareersUrl("https://candidate-connect.oraclecloud.com/")).toMatchObject({
      platform: "oracle",
      confidence: "high",
    });
    expect(fingerprintCareersUrl("https://acme.successfactors.eu/careers")).toMatchObject({
      platform: "successfactors",
    });
    expect(fingerprintCareersUrl("https://acme.sapsf.com/careers")).toMatchObject({
      platform: "successfactors",
    });
    expect(fingerprintCareersUrl("https://acme.tal.net/vacancies")).toMatchObject({
      platform: "tal",
    });
    expect(fingerprintCareersUrl("https://acme.icims.com/jobs")).toMatchObject({
      platform: "icims",
    });
    expect(fingerprintCareersUrl("https://acme.avature.net/vacancies")).toMatchObject({
      platform: "avature",
    });
    expect(fingerprintCareersUrl("https://acme.taleo.net/careers")).toMatchObject({
      platform: "taleo",
    });
    expect(fingerprintCareersUrl("https://careers-page.teamtailor.com/acme")).toMatchObject({
      platform: "teamtailor",
    });
    expect(fingerprintCareersUrl("https://jobs.personio.com/acme")).toMatchObject({
      platform: "personio",
    });
    expect(fingerprintCareersUrl("https://apply.workable.com/acme")).toMatchObject({
      platform: "workable",
    });
    expect(fingerprintCareersUrl("https://acme.jobs.pageuppeople.com/")).toMatchObject({
      platform: "pageup",
    });
    expect(fingerprintCareersUrl("https://careers.recruitee.com/acme")).toMatchObject({
      platform: "recruitee",
    });
    expect(fingerprintCareersUrl("https://acme.eightfold.ai/careers")).toMatchObject({
      platform: "eightfold",
    });
  });

  it("uses path markers at medium confidence on employer-owned domains", () => {
    const match = fingerprintCareersUrl("https://careers.acme.com/taleo/x/roles");
    expect(match).toMatchObject({ platform: "taleo", confidence: "medium" });
    expect(match.evidence[0]).toContain("path contains");
  });

  it("returns unknown for employer domains without platform signatures", () => {
    expect(fingerprintCareersUrl("https://careers.acme.com/")).toMatchObject({
      platform: "unknown",
      confidence: "low",
    });
    expect(fingerprintCareersUrl("https://jobs.acme.com/search")).toMatchObject({
      platform: "unknown",
    });
  });

  it("rejects malformed URLs", () => {
    expect(fingerprintCareersUrl("not a url")).toMatchObject({ platform: "unknown" });
    expect(fingerprintCareersUrl("ftp://acme.com/jobs")).toMatchObject({ platform: "unknown" });
  });
});

describe("atsPlatformFromResearchText", () => {
  it("normalizes workbook platform text", () => {
    expect(atsPlatformFromResearchText("Workday")).toBe("workday");
    expect(atsPlatformFromResearchText("Workday CXS verified")).toBe("workday");
    expect(atsPlatformFromResearchText("Greenhouse")).toBe("greenhouse");
    expect(atsPlatformFromResearchText("Lever")).toBe("lever");
    expect(atsPlatformFromResearchText("Ashby")).toBe("ashby");
    expect(atsPlatformFromResearchText("SmartRecruiters")).toBe("smartrecruiters");
    expect(atsPlatformFromResearchText("Oracle")).toBe("oracle");
    expect(atsPlatformFromResearchText("Oracle Taleo")).toBe("taleo");
    expect(atsPlatformFromResearchText("SAP SuccessFactors")).toBe("successfactors");
    expect(atsPlatformFromResearchText("TAL / tal.net")).toBe("tal");
    expect(atsPlatformFromResearchText("iCIMS")).toBe("icims");
    expect(atsPlatformFromResearchText("Avature")).toBe("avature");
    expect(atsPlatformFromResearchText("Teamtailor")).toBe("teamtailor");
    expect(atsPlatformFromResearchText("Personio")).toBe("personio");
    expect(atsPlatformFromResearchText("Workable")).toBe("workable");
    expect(atsPlatformFromResearchText("PageUp")).toBe("pageup");
    expect(atsPlatformFromResearchText("Recruitee")).toBe("recruitee");
    expect(atsPlatformFromResearchText("Eightfold")).toBe("eightfold");
    expect(atsPlatformFromResearchText("Custom branded careers")).toBe("custom");
    expect(atsPlatformFromResearchText("Direct HTML")).toBe("custom");
  });

  it("treats blanks and non-matches as unknown without false positives", () => {
    expect(atsPlatformFromResearchText(null)).toBe("unknown");
    expect(atsPlatformFromResearchText("")).toBe("unknown");
    expect(atsPlatformFromResearchText("Not researched")).toBe("unknown");
    expect(atsPlatformFromResearchText("Capital One")).toBe("unknown");
    expect(atsPlatformFromResearchText("Vitality")).toBe("unknown");
  });
});

describe("sourceTypeForPlatform", () => {
  it("maps native adapters to their source types and everything else to custom", () => {
    expect(sourceTypeForPlatform("workday")).toBe("workday");
    expect(sourceTypeForPlatform("greenhouse")).toBe("greenhouse");
    expect(sourceTypeForPlatform("lever")).toBe("lever");
    expect(sourceTypeForPlatform("ashby")).toBe("ashby");
    expect(sourceTypeForPlatform("smartrecruiters")).toBe("smartrecruiters");
    expect(sourceTypeForPlatform("oracle")).toBe("custom");
    expect(sourceTypeForPlatform("successfactors")).toBe("custom");
    expect(sourceTypeForPlatform("unknown")).toBe("unknown");
  });
});
