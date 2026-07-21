import { describe, expect, it } from "vitest";

import { assertAllowedAnalyticsProperties, type AnalyticsEvent } from "./analytics";

describe("assertAllowedAnalyticsProperties", () => {
  it("accepts explicitly allowed properties", () => {
    const event: AnalyticsEvent = {
      name: "health_check_observed",
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      properties: { source: "test" },
    };

    expect(() => assertAllowedAnalyticsProperties(event)).not.toThrow();
  });

  it("rejects undeclared properties", () => {
    const event: AnalyticsEvent = {
      name: "health_check_observed",
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      properties: { email: "sensitive@example.com" },
    };

    expect(() => assertAllowedAnalyticsProperties(event)).toThrow("email");
  });

  it("rejects tokens and identifiers on security transition events", () => {
    const event = {
      name: "invitation_accepted",
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      properties: { token: "credential-value" },
    } as unknown as AnalyticsEvent;

    expect(() => assertAllowedAnalyticsProperties(event)).toThrow("token");
  });

  it.each([
    "onboarding_started",
    "onboarding_saved",
    "onboarding_completed",
    "onboarding_updated",
  ] as const)("keeps %s property-free", (name) => {
    const event = {
      name,
      occurredAt: new Date("2026-07-20T00:00:00.000Z"),
      properties: { educationStage: "undergraduate", internalUserId: "private" },
    } as unknown as AnalyticsEvent;
    expect(() => assertAllowedAnalyticsProperties(event)).toThrow(/educationStage/);
  });

  it.each([
    "recommendation_completed",
    "recommendation_dismissed",
    "recommendation_restored",
  ] as const)("keeps %s property-free", (name) => {
    const event = {
      name,
      occurredAt: new Date("2026-07-20T00:00:00.000Z"),
      properties: {
        applicationId: "private",
        recommendationKey: "stage_revealing_key",
        ruleVersion: 1,
      },
    } as unknown as AnalyticsEvent;
    expect(() => assertAllowedAnalyticsProperties(event)).toThrow(/applicationId/);
  });
});
