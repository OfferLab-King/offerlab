import { describe, expect, it } from "vitest";
import { sourceUrlHealthAfterCheck, type SourceUrlHealth } from "./source-health";

const unchecked: SourceUrlHealth = {
  checkedAt: null,
  errorCode: null,
  finalUrl: null,
  invalidSince: null,
  status: "unchecked",
  statusCode: null,
};

describe("source URL health", () => {
  const now = new Date("2026-08-12T10:00:00Z");

  it("reports healthy and redirected URLs independently", () => {
    expect(
      sourceUrlHealthAfterCheck(unchecked, {
        checkedAt: now,
        finalUrl: "https://example.com/careers",
        requestedUrl: "https://example.com/careers",
        statusCode: 200,
      }).status,
    ).toBe("healthy");
    expect(
      sourceUrlHealthAfterCheck(unchecked, {
        checkedAt: now,
        finalUrl: "https://jobs.example.com/",
        requestedUrl: "https://example.com/careers",
        statusCode: 200,
      }).status,
    ).toBe("redirected");
  });

  it("preserves invalid-since across failures and clears it on recovery", () => {
    const failed = sourceUrlHealthAfterCheck(unchecked, {
      checkedAt: now,
      requestedUrl: "https://example.com/careers",
      statusCode: 404,
    });
    const failedAgain = sourceUrlHealthAfterCheck(failed, {
      checkedAt: new Date("2026-08-13T10:00:00Z"),
      requestedUrl: "https://example.com/careers",
      statusCode: 500,
    });
    expect(failedAgain.invalidSince).toEqual(now);
    const recovered = sourceUrlHealthAfterCheck(failedAgain, {
      checkedAt: new Date("2026-08-14T10:00:00Z"),
      finalUrl: "https://example.com/careers",
      requestedUrl: "https://example.com/careers",
      statusCode: 200,
    });
    expect(recovered.invalidSince).toBeNull();
    expect(recovered.status).toBe("healthy");
  });
});
