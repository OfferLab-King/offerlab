import { canonicalizeJobUrl, urlHostname } from "./urls";

export type DiscoveredLocation = Readonly<{
  city: string | null;
  country: string | null;
  hybrid: boolean;
  onSite: boolean;
  region: string | null;
  remote: boolean;
  sourceText: string;
}>;

export type DiscoveredJob = Readonly<{
  externalJobId: string | null;
  sourceUrl: string | null;
  applicationUrl: string;
  title: string;
  locationText: string;
  descriptionText: string;
  employmentType: string | null;
  remoteType: string | null;
  postedAt: Date | null;
  applicationDeadline: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  sourcePayload: unknown;
  locations?: readonly DiscoveredLocation[];
}>;

export type ExistingJobIdentity = Readonly<{
  id: string;
  externalJobId: string | null;
  sourceUrl: string | null;
  applicationUrl: string;
  title: string;
  locationText: string | null;
}>;

export type JobIdentityMatch = Readonly<{
  existingId: string;
  strategy: "external_job_id" | "source_url" | "application_url" | "normalized_fields";
}>;

function normalizedText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/[^a-z0-9 ]/gu, "")
    .trim();
}

function fuzzyLocationKey(value: string | null): string {
  const tokens = new Set(normalizedText(value).split(" ").filter(Boolean));
  tokens.delete("uk");
  tokens.delete("united");
  tokens.delete("kingdom");
  return [...tokens].sort().join(" ");
}

export function resolveJobIdentity(
  discovered: DiscoveredJob,
  existing: readonly ExistingJobIdentity[],
): JobIdentityMatch | null {
  const canonicalSource = canonicalizeJobUrl(discovered.sourceUrl ?? "");
  const canonicalApplication = canonicalizeJobUrl(discovered.applicationUrl);
  const discoveredTitle = normalizedText(discovered.title);
  const discoveredLocation = fuzzyLocationKey(discovered.locationText);
  const discoveredApplyHost = canonicalApplication ? urlHostname(canonicalApplication) : null;

  for (const job of existing) {
    if (discovered.externalJobId && job.externalJobId === discovered.externalJobId) {
      return { existingId: job.id, strategy: "external_job_id" };
    }
  }
  for (const job of existing) {
    if (canonicalSource && job.sourceUrl === canonicalSource) {
      return { existingId: job.id, strategy: "source_url" };
    }
  }
  for (const job of existing) {
    if (job.applicationUrl === canonicalApplication) {
      return { existingId: job.id, strategy: "application_url" };
    }
  }
  if (!discoveredTitle || !discoveredLocation) return null;
  for (const job of existing) {
    // Different authoritative requisition IDs represent different jobs even when
    // an ATS reuses the same title, location and apply host.
    if (
      discovered.externalJobId &&
      job.externalJobId &&
      discovered.externalJobId !== job.externalJobId
    ) {
      continue;
    }
    const existingTitle = normalizedText(job.title);
    const existingLocation = fuzzyLocationKey(job.locationText ?? null);
    const existingApplyHost = job.applicationUrl ? urlHostname(job.applicationUrl) : null;
    if (
      existingTitle === discoveredTitle &&
      existingLocation === discoveredLocation &&
      discoveredApplyHost !== null &&
      existingApplyHost === discoveredApplyHost
    ) {
      return { existingId: job.id, strategy: "normalized_fields" };
    }
  }
  return null;
}
