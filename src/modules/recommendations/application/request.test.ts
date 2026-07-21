import { describe, expect, it } from "vitest";

import {
  parseRecommendationMutationInput,
  readRecommendationJson,
  RECOMMENDATION_JSON_BODY_LIMIT_BYTES,
} from "./request";

const valid = {
  expectedVersion: null,
  recommendationKey: "interview_prepare_examples",
  ruleVersion: 1,
  targetState: "completed",
} as const;

describe("recommendation mutation request", () => {
  it("accepts the strict concurrency input", () => {
    expect(parseRecommendationMutationInput(valid)).toEqual({ ok: true, value: valid });
    expect(
      parseRecommendationMutationInput({ ...valid, expectedVersion: 2, targetState: "pending" }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    { ...valid, ownerId: "20000000-0000-4000-8000-000000000001" },
    { ...valid, applicationId: "10000000-0000-4000-8000-000000000001" },
    { ...valid, version: 1 },
    { ...valid, completedAt: "2026-07-20T00:00:00Z" },
    { ...valid, recommendationKey: "Interview/private" },
    { ...valid, ruleVersion: 0 },
    { ...valid, expectedVersion: 0 },
    { ...valid, targetState: "archived" },
  ])("rejects malformed, unexpected, or caller-controlled fields", (input) => {
    expect(parseRecommendationMutationInput(input)).toEqual({ ok: false });
  });

  it("enforces JSON media type, syntax, and bounded streaming reads", async () => {
    await expect(
      readRecommendationJson(new Request("http://test", { method: "POST" })),
    ).resolves.toEqual({ ok: false, status: 415 });
    await expect(
      readRecommendationJson(
        new Request("http://test", {
          body: "{",
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      ),
    ).resolves.toEqual({ ok: false, status: 400 });
    await expect(
      readRecommendationJson(
        new Request("http://test", {
          body: JSON.stringify({ payload: "x".repeat(RECOMMENDATION_JSON_BODY_LIMIT_BYTES) }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      ),
    ).resolves.toEqual({ ok: false, status: 413 });
  });
});
