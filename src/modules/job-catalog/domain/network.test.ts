import { describe, expect, it } from "vitest";

import { checkPublicInternetUrl, isPrivateAddress } from "./network";

describe("SSRF / private-network protection", () => {
  it("accepts public internet URLs", async () => {
    const decision = await checkPublicInternetUrl(
      "https://api.lever.co/v0/postings/example?mode=json",
      {
        resolve: async () => ["93.184.216.34"],
      },
    );
    expect(decision.outcome).toBe("safe");
  });

  it("rejects loopback and private IPv4 addresses", async () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.5",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
      const decision = await checkPublicInternetUrl(`https://example.com/`, {
        resolve: async () => [address],
      });
      expect(decision.outcome).toBe("private_ip");
    }
  });

  it("rejects IPv4 literals that are private", async () => {
    const decision = await checkPublicInternetUrl("http://10.0.0.1/", { resolve: async () => [] });
    expect(decision.outcome).toBe("private_ip");
  });

  it("rejects loopback and unique-local IPv6", async () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fd12:3456::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    const decision = await checkPublicInternetUrl("https://example.com/", {
      resolve: async () => ["::1"],
    });
    expect(decision.outcome).toBe("private_ip");
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    const decision = await checkPublicInternetUrl("https://jobs.internal.example.com/", {
      resolve: async () => ["169.254.169.254"],
    });
    expect(decision.outcome).toBe("private_ip");
  });

  it("rejects the cloud metadata reserved host by name", async () => {
    const decision = await checkPublicInternetUrl("https://metadata.google.internal/", {
      resolve: async () => ["127.0.0.1"],
    });
    expect(decision.outcome).toBe("reserved_host");
  });

  it("rejects unresolvable hostnames", async () => {
    const decision = await checkPublicInternetUrl("https://no-such-host.invalid/", {
      resolve: async () => [],
    });
    expect(decision.outcome).toBe("dns_failure");
  });

  it("rejects unsafe protocols and embedded credentials", async () => {
    expect((await checkPublicInternetUrl("ftp://example.com/")).outcome).toBe("unsafe_protocol");
    expect((await checkPublicInternetUrl("file:///etc/passwd")).outcome).toBe("unsafe_protocol");
    expect((await checkPublicInternetUrl("https://user:pass@example.com/")).outcome).toBe(
      "unsafe_credentials",
    );
    expect((await checkPublicInternetUrl("not a url")).outcome).toBe("invalid_url");
  });

  it("rejects the localhost reserved host", async () => {
    expect((await checkPublicInternetUrl("http://localhost/")).outcome).toBe("reserved_host");
  });
});
