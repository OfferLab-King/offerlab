import { describe, expect, it } from "vitest";
import {
  demoPlans,
  demoResources,
  demoStableKeys,
  isLocalDatabaseUrl,
} from "../../scripts/learn-demo-content";

describe("local Learn demo seed", () => {
  it("accepts only explicitly approved local database hosts", () => {
    expect(isLocalDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:55322/postgres")).toBe(
      true,
    );
    expect(isLocalDatabaseUrl("postgresql://postgres:postgres@localhost:5432/postgres")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://postgres:secret@database.example.com/postgres")).toBe(
      false,
    );
    expect(isLocalDatabaseUrl("not a URL")).toBe(false);
  });

  it("uses unique stable keys and valid path references for idempotent upserts", () => {
    const keys = demoStableKeys();
    expect(new Set(keys.resources).size).toBe(keys.resources.length);
    expect(new Set(keys.plans).size).toBe(keys.plans.length);
    expect(demoResources.length).toBeGreaterThanOrEqual(24);
    expect(demoResources.length).toBeLessThanOrEqual(33);
    expect(demoPlans).toHaveLength(5);
    const resources = new Set(keys.resources);
    expect(
      demoPlans
        .flatMap((plan) => plan.sections.flatMap((section) => section.resources))
        .every((key) => resources.has(key)),
    ).toBe(true);
  });
});
