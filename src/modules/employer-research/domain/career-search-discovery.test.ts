import { describe, expect, it } from "vitest";

import {
  buildCareerSearchQuery,
  estimateBraveSearchCost,
  planCareerSearchResults,
} from "./career-search-discovery";

describe("career search discovery", () => {
  it("finds official general, early-career and professional pages", () => {
    const plan = planCareerSearchResults("Acme Technology Limited", [
      {
        title: "Careers at Acme Technology",
        url: "https://acmetechnology.co.uk/careers",
        description: "Search jobs at Acme Technology.",
      },
      {
        title: "Students and graduates | Acme Technology",
        url: "https://acmetechnology.co.uk/careers/graduates",
        description: "Early careers and internships at Acme Technology.",
      },
      {
        title: "Experienced professionals | Acme Technology",
        url: "https://jobs.acmetechnology.co.uk/professionals",
        description: "Professional opportunities at Acme Technology.",
      },
    ]);

    expect(plan.officialWebsiteUrl).toBe("https://acmetechnology.co.uk");
    expect(plan.candidates.map((candidate) => candidate.channel)).toEqual([
      "general",
      "early_careers",
      "professional",
    ]);
  });

  it("accepts an identity-backed ATS result and rejects aggregators", () => {
    const plan = planCareerSearchResults("North Star Bank plc", [
      {
        title: "North Star Bank careers",
        url: "https://northstar.wd3.myworkdayjobs.com/en-US/Careers",
        description: "Jobs at North Star Bank",
      },
      {
        title: "North Star Bank jobs",
        url: "https://uk.indeed.com/cmp/North-Star-Bank/jobs",
        description: "Latest vacancies",
      },
    ]);

    expect(plan.officialWebsiteUrl).toBeNull();
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]?.platformHint).toBe("Workday");
  });

  it("rejects a result with no employer identity evidence", () => {
    expect(
      planCareerSearchResults("Acme Limited", [
        {
          title: "Great graduate careers",
          url: "https://unrelated.example/careers",
          description: "Browse jobs",
        },
      ]).candidates,
    ).toHaveLength(0);
  });

  it("does not mistake a third-party article for the official corporate website", () => {
    const plan = planCareerSearchResults("Acme Limited", [
      {
        title: "Acme Limited announces new careers programme",
        url: "https://business-news.example/articles/acme-careers",
        description: "Acme Limited will recruit graduates.",
      },
    ]);
    expect(plan.officialWebsiteUrl).toBeNull();
    expect(plan.candidates[0]?.confidence).toBe("high");
  });

  it("builds exact-name queries and estimates the documented request cost", () => {
    expect(buildCareerSearchQuery('Acme "UK" Ltd')).toContain('"Acme UK Ltd"');
    expect(estimateBraveSearchCost(1_000)).toBe(5);
    expect(estimateBraveSearchCost(127_000)).toBe(635);
  });
});
