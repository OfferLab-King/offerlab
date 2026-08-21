import { fingerprintCareersUrl, sourceTypeForPlatform, type AtsPlatform } from "./ats-fingerprint";

export type SourceAutomationProbe = Readonly<{
  body: string | null;
  method: "GET" | "POST";
  url: string;
}>;

export type SourceAutomationPlan = Readonly<{
  configuration: Readonly<Record<string, string>>;
  crawlEndpointUrl: string;
  platform: AtsPlatform;
  probe: SourceAutomationProbe;
  sourceType: string;
}>;

/**
 * Derives a complete typed-connector configuration from a high-confidence ATS
 * URL. This is a hypothesis until `sourceAutomationProbeMatches` confirms the
 * provider's real public API response; callers must never activate a source
 * from derivation alone.
 */
export function deriveSourceAutomationPlan(
  careersUrl: string,
  candidateEndpoint: string | null = null,
): SourceAutomationPlan | null {
  const fingerprint = fingerprintCareersUrl(careersUrl);
  if (fingerprint.confidence !== "high") return null;

  const url = safeUrl(careersUrl);
  if (!url) return null;
  const segments = url.pathname.split("/").filter(Boolean);

  switch (fingerprint.platform) {
    case "greenhouse": {
      const token = url.hostname.endsWith(".boards.greenhouse.io")
        ? url.hostname.split(".")[0]
        : segments[0];
      if (!token) return null;
      const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`;
      return plan(fingerprint.platform, { greenhouseBoardToken: token }, endpoint, "GET");
    }
    case "lever": {
      const company = segments[0];
      if (!company) return null;
      const endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
      return plan(fingerprint.platform, { leverCompany: company }, endpoint, "GET");
    }
    case "ashby": {
      const org = segments[0];
      if (!org) return null;
      const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`;
      return plan(fingerprint.platform, { ashbyOrg: org }, endpoint, "GET");
    }
    case "smartrecruiters": {
      const company = segments[0];
      if (!company) return null;
      const endpoint = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=1`;
      return plan(fingerprint.platform, { smartRecruitersCompany: company }, endpoint, "GET");
    }
    case "workable": {
      const account = segments[0];
      if (!account) return null;
      const endpoint = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}`;
      return plan(fingerprint.platform, { workableAccount: account }, endpoint, "GET");
    }
    case "teamtailor": {
      const company = url.hostname.split(".")[0];
      if (!company) return null;
      const endpoint = `https://${encodeURIComponent(company)}.teamtailor.com/jobs.json`;
      return plan(fingerprint.platform, { teamtailorCompany: company }, endpoint, "GET");
    }
    case "workday": {
      const endpoint = validatedWorkdayEndpoint(candidateEndpoint) ?? deriveWorkdayEndpoint(url);
      if (!endpoint) return null;
      return plan(
        fingerprint.platform,
        { cxsEndpoint: endpoint },
        endpoint,
        "POST",
        JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
      );
    }
    default:
      return null;
  }
}

/**
 * Produces a small deterministic set of Workday site hypotheses when research
 * contains only the tenant root. Every hypothesis still requires the live API
 * shape probe; this list is discovery, never activation evidence.
 */
export function deriveSourceAutomationCandidates(
  careersUrl: string,
  candidateEndpoint: string | null,
  companyName: string,
): readonly SourceAutomationPlan[] {
  const direct = deriveSourceAutomationPlan(careersUrl, candidateEndpoint);
  if (direct) return [direct];
  const url = safeUrl(careersUrl);
  const fingerprint = fingerprintCareersUrl(careersUrl);
  if (!url || fingerprint.platform !== "workday") return [];
  const tenant = url.hostname.split(".")[0];
  if (!tenant) return [];
  const compactCompany = companyName.replace(/[^a-z0-9]/giu, "");
  const pascalTenant = tenant.charAt(0).toUpperCase() + tenant.slice(1);
  const acronym = companyName
    .split(/[^a-z0-9]+/iu)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const sites = [
    `${pascalTenant}Careers`,
    `${tenant}careers`,
    `${compactCompany}Careers`,
    compactCompany,
    `${acronym}_Careers`,
    `${acronym}Careers`,
    "Careers",
    "careers",
    "External_Careers",
    "EXTERNAL_CAREERS",
    "External_Career_Site",
    "External",
    "CorporateCareers",
    "jobs",
    "Jobs",
  ].filter(Boolean);
  const plans = new Map<string, SourceAutomationPlan>();
  for (const site of sites) {
    const endpoint = `https://${url.host}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`;
    const candidate = deriveSourceAutomationPlan(careersUrl, endpoint);
    if (candidate) plans.set(candidate.crawlEndpointUrl, candidate);
  }
  return [...plans.values()];
}

export function sourceAutomationProbeMatches(
  plan: SourceAutomationPlan,
  status: number,
  body: string,
): boolean {
  if (status < 200 || status >= 300) return false;
  try {
    const parsed = JSON.parse(body) as unknown;
    switch (plan.platform) {
      case "greenhouse":
        return hasArray(parsed, "jobs");
      case "lever":
        return Array.isArray(parsed);
      case "ashby":
        return hasArray(parsed, "jobs");
      case "smartrecruiters":
        return hasArray(parsed, "content");
      case "workable":
        return hasArray(parsed, "jobs");
      case "teamtailor":
        return hasArray(parsed, "items");
      case "workday":
        return hasArray(parsed, "jobPostings");
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function plan(
  platform: AtsPlatform,
  configuration: Readonly<Record<string, string>>,
  crawlEndpointUrl: string,
  method: "GET" | "POST",
  body: string | null = null,
): SourceAutomationPlan {
  return {
    configuration,
    crawlEndpointUrl,
    platform,
    probe: { body, method, url: crawlEndpointUrl },
    sourceType: sourceTypeForPlatform(platform),
  };
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function validatedWorkdayEndpoint(value: string | null): string | null {
  if (!value) return null;
  const url = safeUrl(value);
  if (!url || !url.pathname.includes("/wday/cxs/") || !url.pathname.endsWith("/jobs")) return null;
  return url.toString();
}

function deriveWorkdayEndpoint(url: URL): string | null {
  const tenant = url.hostname.split(".")[0];
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^[a-z]{2}(?:-[A-Z]{2})?$/u.test(segment));
  const site = segments[0];
  if (!tenant || !site) return null;
  return `https://${url.host}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`;
}

function hasArray(value: unknown, key: string): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    key in value &&
    Array.isArray((value as Readonly<Record<string, unknown>>)[key]),
  );
}
