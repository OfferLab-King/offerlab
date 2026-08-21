import { describe, expect, it } from "vitest";

import {
  isDestinationCurrent,
  memberAccountLinks,
  memberNavLinks,
  publicNavLinks,
} from "./site-navigation";

describe("isDestinationCurrent", () => {
  it("keeps Workspace current on its private sub-pages", () => {
    expect(isDestinationCurrent("/member", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/applications", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/cvs", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/cover-letters", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/documents", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/saved-jobs", "/member")).toBe(true);
    expect(isDestinationCurrent("/member/learn/answer-bank", "/member")).toBe(false);
    expect(isDestinationCurrent("/member/learn", "/member")).toBe(false);
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

  it("keeps Answer Bank current on its workspace", () => {
    expect(isDestinationCurrent("/member/learn/answer-bank", "/member/learn/answer-bank")).toBe(
      true,
    );
    expect(
      isDestinationCurrent("/member/learn/answer-bank/stories", "/member/learn/answer-bank"),
    ).toBe(true);
    expect(isDestinationCurrent("/member/learn", "/member/learn/answer-bank")).toBe(false);
  });

  it("keeps Library current across learning routes except Answer Bank", () => {
    expect(isDestinationCurrent("/member/learn", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/resources", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/paths", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/intelligence/report-1", "/member/learn")).toBe(true);
    expect(isDestinationCurrent("/member/learn/answer-bank", "/member/learn")).toBe(false);
  });

  it("keeps Profile current on the onboarding routes", () => {
    expect(isDestinationCurrent("/member/onboarding", "/member/onboarding")).toBe(true);
    expect(isDestinationCurrent("/member/onboarding/anything", "/member/onboarding")).toBe(true);
    expect(isDestinationCurrent("/member/learn", "/member/onboarding")).toBe(false);
  });

  it("exposes the required member destination list", () => {
    expect(memberNavLinks.map(({ label }) => label)).toEqual([
      "Workspace",
      "Jobs",
      "Employers",
      "Answer Bank",
      "Library",
    ]);
  });

  it("exposes Plans in the public navigation", () => {
    expect(publicNavLinks.map(({ label }) => label)).toEqual([
      "Jobs",
      "Employers",
      "Recruitment Intelligence",
      "Plans",
    ]);
  });

  it("uses the unified Plans page for member plan management", () => {
    expect(memberAccountLinks).toContainEqual({ href: "/plans", label: "Plans" });
    expect(memberAccountLinks.map(({ href }) => href)).not.toContain("/member/membership");
  });
});
