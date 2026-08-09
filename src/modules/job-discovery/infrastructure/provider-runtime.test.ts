import { describe, expect, it, vi } from "vitest";
import { createJobDiscoveryRuntime } from "./provider-runtime";

describe("job discovery provider runtime", () => {
  it.each([undefined, "", "prodution"])(
    "fails closed for an absent or invalid APP_ENV (%s)",
    (appEnvironment) => {
      expect(
        createJobDiscoveryRuntime({
          apiKey: "synthetic-test-key",
          appEnvironment,
          enabled: true,
          productionUseApproved: true,
        }),
      ).toEqual({ available: false, reason: "invalid_configuration" });
    },
  );

  it("stays unavailable when disabled or missing its server credential", () => {
    expect(
      createJobDiscoveryRuntime({
        appEnvironment: "local",
        enabled: false,
        productionUseApproved: false,
      }),
    ).toEqual({ available: false, reason: "disabled" });
    expect(
      createJobDiscoveryRuntime({
        apiKey: "",
        appEnvironment: "local",
        enabled: true,
        productionUseApproved: false,
      }),
    ).toEqual({ available: false, reason: "missing_configuration" });
  });

  it("enforces the supplied production approval flag", () => {
    expect(
      createJobDiscoveryRuntime({
        apiKey: "synthetic-test-key",
        appEnvironment: "production",
        enabled: true,
        productionUseApproved: false,
      }),
    ).toEqual({ available: false, reason: "production_not_approved" });
  });

  it("returns an injected provider for approved configuration", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        data: { cursor: null, jobs: [] },
        parameters: {},
        request_id: "synthetic-request-id",
        status: "OK",
      }),
    );
    const runtime = createJobDiscoveryRuntime(
      {
        apiKey: "synthetic-test-key",
        appEnvironment: "production",
        enabled: true,
        productionUseApproved: true,
      },
      fetchImplementation as typeof fetch,
    );
    expect(runtime.available).toBe(true);
    if (!runtime.available) throw new Error("Expected an available runtime.");

    await expect(
      runtime.provider.search({
        datePosted: "all",
        employmentTypes: [],
        jobRequirements: [],
        location: "London",
        remoteOnly: false,
        role: "Data analyst",
      }),
    ).resolves.toEqual({ jobs: [], nextCursor: null });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
