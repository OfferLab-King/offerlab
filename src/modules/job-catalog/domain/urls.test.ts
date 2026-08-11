import { describe, expect, it } from "vitest";

import { canonicalizeJobUrl, isSafeWebUrl, slugify, slugifyTitle, urlHostname } from "./urls";

describe("URL canonicalization", () => {
  it("strips tracking parameters", () => {
    expect(
      canonicalizeJobUrl(
        "https://boards.greenhouse.io/monzo/jobs/123?utm_source=linkedin&gh_src=abc&utm_campaign=grad",
      ),
    ).toBe("https://boards.greenhouse.io/monzo/jobs/123");
  });

  it("keeps meaningful query parameters", () => {
    expect(canonicalizeJobUrl("https://jobs.example.com/123?department=engineering")).toBe(
      "https://jobs.example.com/123?department=engineering",
    );
  });

  it("normalises the trailing slash and removes fragments", () => {
    expect(canonicalizeJobUrl("https://jobs.example.com/123/")).toBe(
      "https://jobs.example.com/123",
    );
    expect(canonicalizeJobUrl("https://jobs.example.com/123#apply")).toBe(
      "https://jobs.example.com/123",
    );
  });

  it("rejects unsafe protocols, credentials and malformed URLs", () => {
    expect(canonicalizeJobUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeJobUrl("ftp://example.com/job")).toBeNull();
    expect(canonicalizeJobUrl("https://user:pass@example.com/job")).toBeNull();
    expect(canonicalizeJobUrl("not a url")).toBeNull();
  });

  it("isSafeWebUrl accepts only http(s)", () => {
    expect(isSafeWebUrl("https://example.com")).toBe(true);
    expect(isSafeWebUrl("http://example.com")).toBe(true);
    expect(isSafeWebUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeWebUrl("javascript:void(0)")).toBe(false);
    expect(isSafeWebUrl("https://user:pass@example.com/job")).toBe(false);
  });

  it("urlHostname strips the www prefix", () => {
    expect(urlHostname("https://www.example.com/jobs/1")).toBe("example.com");
    expect(urlHostname("https://api.lever.co/x")).toBe("api.lever.co");
  });
});

describe("slugify", () => {
  it("creates safe lowercase slugs", () => {
    expect(slugify("Graduate Analyst (2026)!")).toBe("graduate-analyst-2026");
    expect(slugify("---  hello ---")).toBe("hello");
  });

  it("prepends the company slug for job slugs", () => {
    expect(slugifyTitle("Graduate Analyst", "monzo")).toBe("monzo-graduate-analyst");
  });
});
