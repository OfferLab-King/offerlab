import { describe, expect, it } from "vitest";

import { ONBOARDING_JSON_BODY_LIMIT_BYTES, readOnboardingJson } from "./request";

describe("onboarding request reader", () => {
  it("reads a bounded JSON request", async () => {
    const result = await readOnboardingJson(
      new Request("http://localhost/api/member/onboarding", {
        body: JSON.stringify({ intent: "save" }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }),
    );
    expect(result).toEqual({ ok: true, value: { intent: "save" } });
  });

  it("rejects oversized, malformed and unsupported requests", async () => {
    const oversized = await readOnboardingJson(
      new Request("http://localhost/api/member/onboarding", {
        body: "x".repeat(ONBOARDING_JSON_BODY_LIMIT_BYTES + 1),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }),
    );
    expect(oversized).toEqual({ ok: false, status: 413 });

    const malformed = await readOnboardingJson(
      new Request("http://localhost/api/member/onboarding", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "PUT",
      }),
    );
    expect(malformed).toEqual({ ok: false, status: 400 });

    const unsupported = await readOnboardingJson(
      new Request("http://localhost/api/member/onboarding", {
        body: "{}",
        headers: { "content-type": "text/plain" },
        method: "PUT",
      }),
    );
    expect(unsupported).toEqual({ ok: false, status: 415 });
  });
});
