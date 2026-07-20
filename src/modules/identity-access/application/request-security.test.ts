import { afterEach, describe, expect, it } from "vitest";

import { hasSameOrigin, requestClientAddress } from "./request-security";

const originalAppEnv = process.env.APP_ENV;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("public authentication request security", () => {
  it("uses only the ingress-overwritten header in production", () => {
    process.env.APP_ENV = "production";
    const spoofed = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "203.0.113.11",
      "x-real-ip": "203.0.113.12",
    });
    expect(requestClientAddress(spoofed)).toBe("unknown");
    spoofed.set("x-vercel-forwarded-for", "198.51.100.20");
    expect(requestClientAddress(spoofed)).toBe("198.51.100.20");
    spoofed.set("x-vercel-forwarded-for", "not-an-ip");
    expect(requestClientAddress(spoofed)).toBe("unknown");
  });

  it("preserves safe local proxy behavior", () => {
    process.env.APP_ENV = "local";
    expect(requestClientAddress(new Headers({ "x-forwarded-for": "127.0.0.1" }))).toBe("127.0.0.1");
  });

  it("requires configured Origin and Host to agree", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://offerlab.example";
    const valid = new Request("https://offerlab.example/api/auth/recovery", {
      headers: { host: "offerlab.example", origin: "https://offerlab.example" },
      method: "POST",
    });
    expect(hasSameOrigin(valid)).toBe(true);
    expect(
      hasSameOrigin(
        new Request("https://offerlab.example/api/auth/recovery", {
          headers: { host: "attacker.invalid", origin: "https://attacker.invalid" },
          method: "POST",
        }),
      ),
    ).toBe(false);
  });
});
