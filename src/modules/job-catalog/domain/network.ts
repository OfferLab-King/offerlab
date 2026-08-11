import { lookup } from "node:dns/promises";

export type NetworkSafetyResult =
  | { outcome: "safe"; hostname: string }
  | { outcome: "invalid_url" }
  | { outcome: "unsafe_protocol" }
  | { outcome: "unsafe_credentials" }
  | { outcome: "private_ip" }
  | { outcome: "reserved_host" }
  | { outcome: "dns_failure" };

export type HostResolver = (hostname: string) => Promise<readonly string[]>;

export function defaultHostResolver(hostname: string): Promise<readonly string[]> {
  return lookup(hostname, { all: true }).then(
    (addresses) => addresses.map((address) => address.address),
    () => [],
  );
}

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number.parseInt(part, 10);
    if (!/^\d{1,3}$/u.test(part) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return false;
  if (value === 0x00000000 || value === 0xffffffff) return true;
  if (value >>> 24 === 10) return true;
  if ((value & 0xfff00000) >>> 0 === 0xac100000) return true; // 172.16.0.0/12
  if (value >>> 16 === 0xc0a8) return true;
  if (value >>> 24 === 127) return true;
  if (value >>> 16 === 0xa9fe) return true;
  if (value >>> 22 === 0x644) return true; // 100.64.0.0/10 CGNAT
  if (value >>> 24 === 0xc000 && (value & 0xffff) === 0x0002) return true; // 192.0.2.0/24
  if (value >>> 24 === 0xc633) return true; // 198.51.100.0/24
  if (value >>> 24 === 0xcb00) return true; // 203.0.113.0/24
  if (value >>> 16 === 0xc612) return true; // 198.18.0.0/15 benchmark
  if (value >>> 28 === 0xe) return true; // 224.0.0.0/4 multicast
  return false;
}

function normalizeIpv6(address: string): string {
  const lower = address.toLowerCase();
  return lower.replace(/^::ffff:(.+)$/u, (_, mapped: string) => {
    if (mapped.includes(".")) return `::ffff:${mapped}`;
    return mapped;
  });
}

function isPrivateIpv6(address: string): boolean {
  const normalized = normalizeIpv6(address);
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 ULA
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  )
    return true; // fe80::/10 link-local
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    if (mapped.includes(".")) return isPrivateIpv4(mapped);
    if (/^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/u.test(mapped)) {
      const [high, low] = mapped.split(":").map((part) => Number.parseInt(part, 16));
      const value = ((high ?? 0) << 16) | (low ?? 0);
      return isPrivateIpv4(
        `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`,
      );
    }
  }
  return false;
}

function isIpLiteral(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/u.test(hostname)) return true;
  return hostname.includes(":") && /^[0-9a-f:.]+$/iu.test(hostname);
}

const reservedHosts = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.internal.",
]);

export async function checkPublicInternetUrl(
  value: string,
  options: Readonly<{ resolve?: HostResolver }> = {},
): Promise<NetworkSafetyResult> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { outcome: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { outcome: "unsafe_protocol" };
  if (url.username || url.password) return { outcome: "unsafe_credentials" };
  const hostname = url.hostname.replace(/\.$/u, "").toLowerCase();
  if (hostname.length === 0) return { outcome: "invalid_url" };
  if (reservedHosts.has(hostname)) return { outcome: "reserved_host" };

  if (isIpLiteral(hostname)) {
    const addresses =
      hostname.includes(":") && !/^\d{1,3}(\.\d{1,3}){3}$/u.test(hostname)
        ? [hostname]
        : [hostname];
    if (
      addresses.some((address) =>
        address.includes(":") ? isPrivateIpv6(address) : isPrivateIpv4(address),
      )
    ) {
      return { outcome: "private_ip" };
    }
    return { outcome: "safe", hostname };
  }

  const resolve = options.resolve ?? defaultHostResolver;
  const addresses = await resolve(hostname);
  if (addresses.length === 0) return { outcome: "dns_failure" };
  for (const address of addresses) {
    if (address.includes(":") ? isPrivateIpv6(address) : isPrivateIpv4(address)) {
      return { outcome: "private_ip" };
    }
  }
  return { outcome: "safe", hostname };
}

export function isPrivateAddress(address: string): boolean {
  return address.includes(":") ? isPrivateIpv6(address) : isPrivateIpv4(address);
}
