import { describe, expect, it } from "vitest";
import { isMemberDestinationCurrent } from "./member-nav-links";

describe("member navigation", () => {
  it("uses an exact match for Home", () => {
    expect(isMemberDestinationCurrent("/member", "/member")).toBe(true);
    expect(isMemberDestinationCurrent("/member/jobs", "/member")).toBe(false);
  });

  it("keeps each nested career destination current", () => {
    expect(isMemberDestinationCurrent("/member/jobs/123", "/member/jobs")).toBe(true);
    expect(isMemberDestinationCurrent("/member/cvs/123", "/member/cvs")).toBe(true);
    expect(isMemberDestinationCurrent("/member/cover-letters/123", "/member/cover-letters")).toBe(
      true,
    );
  });
});
