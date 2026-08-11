import { describe, expect, it } from "vitest";

import { escapeJsonLd, isPubliclyVisible } from "./publication";

describe("public visibility predicate", () => {
  const now = new Date("2026-08-01T00:00:00Z");
  const base = {
    active: true,
    application_deadline: null,
    eligibility_status: "eligible",
    publication_status: "published",
  };

  it("shows eligible published active roles", () => {
    expect(isPubliclyVisible(base, now)).toBe(true);
  });

  it("hides draft, suppressed and needs-review roles", () => {
    expect(isPubliclyVisible({ ...base, publication_status: "draft" }, now)).toBe(false);
    expect(isPubliclyVisible({ ...base, publication_status: "suppressed" }, now)).toBe(false);
    expect(isPubliclyVisible({ ...base, eligibility_status: "needs_review" }, now)).toBe(false);
    expect(isPubliclyVisible({ ...base, eligibility_status: "ineligible" }, now)).toBe(false);
  });

  it("hides inactive and deadline-passed roles", () => {
    expect(isPubliclyVisible({ ...base, active: false }, now)).toBe(false);
    expect(
      isPubliclyVisible({ ...base, application_deadline: new Date("2020-01-01T00:00:00Z") }, now),
    ).toBe(false);
    expect(
      isPubliclyVisible({ ...base, application_deadline: new Date("2026-12-01T00:00:00Z") }, now),
    ).toBe(true);
  });
});

describe("JSON-LD escaping", () => {
  it("escapes HTML-significant characters", () => {
    const escaped = escapeJsonLd({ title: "</script><script>alert(1)</script>", company: "A&B" });
    expect(escaped).not.toContain("</script>");
    expect(escaped).not.toContain("<");
    expect(escaped).toContain("\\u003c/script\\u003e");
    expect(escaped).toContain("\\u0026");
  });

  it("escapes line separators and round-trips through JSON.parse", () => {
    const escaped = escapeJsonLd({ title: "line\u2028separator" });
    expect(escaped).toContain("\\u2028");
    expect(JSON.parse(escaped).title).toBe("line\u2028separator");
  });

  it("keeps ordinary structured data intact", () => {
    const value = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Graduate Analyst",
    };
    expect(JSON.parse(escapeJsonLd(value))).toEqual(value);
  });
});
