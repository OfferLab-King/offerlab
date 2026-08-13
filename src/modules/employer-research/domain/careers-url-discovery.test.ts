import { describe, expect, it } from "vitest";

import { extractCareersUrls, planHomepageCareersUrl } from "./careers-url-discovery";

const HOMEPAGE =
  "<html><body><nav>" +
  '<a href="/careers">Careers</a>' +
  '<a href="/join-us">Join us</a>' +
  '<a href="/about">About</a>' +
  '<a href="/login">Login</a>' +
  '<a href="/cookie-policy">Cookies</a>' +
  "</nav><main>" +
  '<a href="https://boards.greenhouse.io/acme">Current jobs</a>' +
  '<a href="/apply">Apply now</a>' +
  "</main></body></html>";

describe("extractCareersUrls", () => {
  it("finds careers links on the same host and includes ATS links", () => {
    const candidates = extractCareersUrls(HOMEPAGE, "https://acme.example.com/");
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    const top = candidates[0]!;
    expect(top.url).toBe("https://acme.example.com/careers");
    const urls = candidates.map((candidate) => candidate.url);
    expect(urls).toContain("https://boards.greenhouse.io/acme");
    const hosts = candidates.map((candidate) => candidate.host);
    expect(hosts).toContain("acme.example.com");
  });

  it("ranks an ATS link above a plain same-host jobs link", () => {
    const html = '<a href="/jobs">Jobs</a>' + '<a href="https://jobs.lever.co/acme">All jobs</a>';
    const candidates = extractCareersUrls(html, "https://acme.example.com/");
    expect(candidates[0]!.url).toBe("https://jobs.lever.co/acme");
  });

  it("excludes login, cookie and apply-only links", () => {
    const urls = extractCareersUrls(HOMEPAGE, "https://acme.example.com/").map(
      (candidate) => candidate.url,
    );
    expect(urls.some((url) => url.includes("/login"))).toBe(false);
    expect(urls.some((url) => url.includes("/cookie-policy"))).toBe(false);
    expect(urls.some((url) => url.includes("/apply"))).toBe(false);
  });

  it("deduplicates canonical URLs", () => {
    const html =
      '<a href="/careers?utm_source=home">Careers</a>' +
      '<a href="https://acme.example.com/careers">Careers</a>';
    const urls = extractCareersUrls(html, "https://acme.example.com/").map(
      (candidate) => candidate.url,
    );
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("returns empty for pages without careers links", () => {
    expect(extractCareersUrls("<a href='/about'>About</a>", "https://acme.example.com/")).toEqual(
      [],
    );
  });

  it("returns empty for malformed html", () => {
    expect(extractCareersUrls("not html at all", "https://acme.example.com/")).toEqual([]);
  });
});

describe("planHomepageCareersUrl", () => {
  it("identifies the platform of the discovered careers URL", () => {
    const plan = planHomepageCareersUrl(
      '<a href="https://acme.wd3.myworkdayjobs.com/careers">Careers</a>',
      "https://acme.example.com/",
    );
    expect(plan).toMatchObject({
      candidateUrl: "https://acme.wd3.myworkdayjobs.com/careers",
      fingerprintPlatform: "workday",
      fingerprintConfidence: "high",
      status: "platform_identified",
    });
  });

  it("keeps unknown platforms as candidate_found", () => {
    const plan = planHomepageCareersUrl(
      '<a href="/careers">Careers</a>',
      "https://acme.example.com/",
    );
    expect(plan).toMatchObject({
      fingerprintPlatform: "unknown",
      status: "candidate_found",
    });
  });

  it("returns null when no careers link exists", () => {
    expect(planHomepageCareersUrl("<a href='/about'>About</a>", "https://acme.example.com/")).toBe(
      null,
    );
  });
});
