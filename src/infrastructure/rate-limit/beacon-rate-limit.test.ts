import { beforeEach, describe, expect, it } from "vitest";

import { checkBeaconRateLimit, resetBeaconRateLimitForTests } from "./beacon-rate-limit";

function requestWithIp(ip: string): Request {
  return new Request("https://example.test/api/jobs/events", {
    headers: { "x-forwarded-for": ip },
    method: "POST",
  });
}

describe("beacon rate limit", () => {
  beforeEach(() => resetBeaconRateLimitForTests());

  it("allows requests under the limit", () => {
    const request = requestWithIp("1.1.1.1");
    for (let index = 0; index < 60; index += 1) {
      expect(checkBeaconRateLimit(request)).toBe(true);
    }
  });

  it("blocks the 61st request in the window", () => {
    const request = requestWithIp("2.2.2.2");
    for (let index = 0; index < 60; index += 1) checkBeaconRateLimit(request);
    expect(checkBeaconRateLimit(request)).toBe(false);
  });

  it("isolates buckets per IP", () => {
    const first = requestWithIp("3.3.3.3");
    const second = requestWithIp("4.4.4.4");
    for (let index = 0; index < 60; index += 1) checkBeaconRateLimit(first);
    expect(checkBeaconRateLimit(first)).toBe(false);
    expect(checkBeaconRateLimit(second)).toBe(true);
  });
});
