import { describe, expect, it } from "vitest";
import { communityTermsVersion, parseComment, parseCommentFlagReason } from "./community";

const valid = {
  agreementConfirmed: true,
  body: "Did the presentation happen before the group exercise?",
  parentCommentId: null,
  reportId: "10000000-0000-4000-8000-000000000001",
};

describe("Recruitment Intelligence community input", () => {
  it("normalises a focused comment without flattening paragraphs", () => {
    expect(
      parseComment({ ...valid, body: "  First paragraph.\r\n\r\n\r\nSecond paragraph.  " }),
    ).toEqual({
      ok: true,
      value: { ...valid, body: "First paragraph.\n\nSecond paragraph." },
    });
  });

  it.each([
    ["empty", " "],
    ["too long", "x".repeat(1001)],
  ])("rejects %s comments", (_name, body) => {
    expect(parseComment({ ...valid, body }).ok).toBe(false);
  });

  it("accepts only controlled flag reasons and a versioned agreement", () => {
    expect(communityTermsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseCommentFlagReason("confidentiality")).toBe("confidentiality");
    expect(parseCommentFlagReason("complaint")).toBeNull();
  });
});
