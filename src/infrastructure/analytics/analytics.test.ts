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
});
