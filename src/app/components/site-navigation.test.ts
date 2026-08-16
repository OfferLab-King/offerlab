import { describe, expect, it } from "vitest";

import { isDestinationCurrent, memberNavLinks, publicNavLinks } from "./site-navigation";

describe("isDestinationCurrent", () => {
  it("keeps Home current only on exactly /member", () => {
    expect(isDestinationCurrent("/member", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/applications", "/member")).toBe(false);
    expect(isDestinationCurrent("/member-jobs", "/member")).toBe(false);
  });

  it("keeps Jobs current on /jobs and every nested page", () => {
    expect(isDestinationCurrent("/jobs", "/jobs")).toBe(true);
    expect(isDestinationCurrent("/jobs/analyst-role", "/jobs")).toBe(true);
    expect(isDestinationCurrent("/jobs/sectors/technology-it", "/jobs")).toBe(true);
    expect(isDestinationCurrent("/employers", "/jobs")).toBe(false);
    expect(isDestinationCurrent("/jobs-archive", "/jobs")).toBe(false);
  });

  it("keeps Employers current on /employers and every nested page", () => {
    expect(isDestinationCurrent("/employers", "/employers")).toBe(true);
    expect(isDestinationCurrent("/employers/synthetic-bank", "/employers")).toBe(true);
    expect(isDestinationCurrent("/jobs", "/employers")).toBe(false);
  });

  it("keeps Applications current across the applications workspace", () => {
    expect(isDestinationCurrent("/member/applications", "/member/applications")).toBe(true);
    expect(isDestinationCurrent("/member/applications/new", "/member/applications")).toBe(true);
    expect(isDestinationCurrent("/member/applications/abc-123", "/member/applications")).toBe(true);
    expect(isDestinationCurrent("/member", "/member/applications")).toBe(false);
  });

  it("keeps CVs and Cover letters current on their document routes", () => {
    expect(isDestinationCurrent("/member/cvs", "/member/cvs")).toBe(true);
    expect(isDestinationCurrent("/member/cvs/abc-123", "/member/cvs")).toBe(true);
    expect(isDestinationCurrent("/member/cover-letters", "/member/cover-letters")).toBe(true);
    expect(isDestinationCurrent("/member/cover-letters/abc-123", "/member/cover-letters")).toBe(
      true,
    );
    expect(isDestinationCurrent("/member/cvs", "/member/cover-letters")).toBe(false);
  });

  it("keeps Prepare current across learning routes", () => {
    expect(isDestinationCurrent("/member/learn", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/resources", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/paths", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/intelligence/report-1", "/member/learn")).toBe(true);
  });

  it("keeps Profile current on the onboarding routes", () => {
    expect(isDestinationCurrent("/member/onboarding", "/member/onboarding")).toBe(true);
    expect(isDestinationCurrent("/member/onboarding/anything", "/member/onboarding")).toBe(true);
    expect(isDestinationCurrent("/member/learn", "/member/onboarding")).toBe(false);
  });

  it("exposes the required member destination list", () => {
    expect(memberNavLinks.map(({ label }) => label)).toEqual([
      "Home",
      "Jobs",
      "Saved jobs",
      "Employers",
      "Applications",
      "CVs",
      "Cover letters",
      "Prepare",
      "Membership",
      "Profile",
    ]);
  });

  it("keeps Saved jobs current on its workspace routes", () => {
    expect(isDestinationCurrent("/member/saved-jobs", "/member/saved-jobs")).toBe(true);
    expect(isDestinationCurrent("/member", "/member/saved-jobs")).toBe(false);
    expect(isDestinationCurrent("/member/saved-jobs", "/member")).toBe(false);
  });

  it("keeps Membership current on the membership routes", () => {
    expect(isDestinationCurrent("/member/membership", "/member/membership")).toBe(true);
    expect(isDestinationCurrent("/member/learn", "/member/membership")).toBe(false);
  });

  it("exposes Plans in the public navigation", () => {
    expect(publicNavLinks.map(({ label }) => label)).toEqual([
      "Jobs",
      "Employers",
      "Recruitment Intelligence",
      "Plans",
    ]);
  });
});
