import { atsPlatforms, platformLabel, type AtsPlatform } from "../domain/ats-fingerprint";

export type DiscoveryQueueFilters = Readonly<{
  tier: string | null;
  platform: string | null;
  status: string | null;
  search: string | null;
}>;

export const DISCOVERY_TIERS = ["P0", "P1", "P2", "P3"] as const;

export const DISCOVERY_PLATFORMS: readonly AtsPlatform[] = [...atsPlatforms].filter(
  (platform) => platform !== "unknown",
);

export const DISCOVERY_STATUSES = [
  "not_researched",
  "researching",
  "candidate_found",
  "platform_identified",
  "endpoint_identified",
  "verified",
  "failed",
  "blocked",
  "unsupported",
  "promoted",
] as const;

export const discoveryStatusLabels: Readonly<Record<string, string>> = {
  not_researched: "Not researched",
  researching: "Researching",
  candidate_found: "Candidate URL",
  platform_identified: "Platform identified",
  endpoint_identified: "Endpoint identified",
  verified: "Verified",
  failed: "Failed",
  blocked: "Blocked",
  unsupported: "Unsupported",
  promoted: "Promoted",
};

export function parseDiscoveryQueueFilters(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): DiscoveryQueueFilters {
  const single = (key: string): string | null => {
    const value = searchParams[key];
    if (typeof value !== "string" || value.length === 0) return null;
    return value;
  };
  const tier = single("tier")?.toUpperCase() ?? null;
  const platform = single("platform")?.toLowerCase() ?? null;
  const status = single("status") ?? null;
  return {
    tier: DISCOVERY_TIERS.includes(tier as never) ? tier : null,
    platform:
      platform && DISCOVERY_PLATFORMS.some((candidate) => candidate === platform) ? platform : null,
    status: DISCOVERY_STATUSES.includes(status as never) ? status : null,
    search: single("q")?.trim().toLowerCase() ?? null,
  };
}

export function platformDisplayName(platform: AtsPlatform | string | null): string {
  if (!platform) return "–";
  return platformLabel(platform as AtsPlatform);
}
