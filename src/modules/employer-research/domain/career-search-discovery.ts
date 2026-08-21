import { fingerprintCareersUrl, platformLabel } from "./ats-fingerprint";

export type CareerSearchResult = Readonly<{
  title: string;
  url: string;
  description: string;
}>;

export type CareerDiscoveryCandidate = Readonly<{
  url: string;
  channel: "early_careers" | "professional" | "apprenticeships" | "general";
  platformHint: string | null;
  confidence: "high" | "medium";
  evidence: readonly string[];
}>;

export type CareerSearchPlan = Readonly<{
  officialWebsiteUrl: string | null;
  candidates: readonly CareerDiscoveryCandidate[];
}>;

const legalSuffixes = new Set([
  "and",
  "company",
  "co",
  "limited",
  "ltd",
  "llp",
  "llc",
  "inc",
  "incorporated",
  "plc",
  "uk",
  "the",
]);

const blockedHosts = [
  "companieshouse.gov.uk",
  "find-and-update.company-information.service.gov.uk",
  "gov.uk",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "reed.co.uk",
  "totaljobs.com",
  "jobsite.co.uk",
  "monster.co.uk",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "wikipedia.org",
];

const atsHosts = [
  "myworkdayjobs.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "smartrecruiters.com",
  "successfactors.com",
  "oraclecloud.com",
  "icims.com",
  "avature.net",
  "taleo.net",
  "teamtailor.com",
  "personio.com",
  "workable.com",
  "pageuppeople.com",
  "recruitee.com",
  "eightfold.ai",
];

function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, " ")
    .trim()
    .toLowerCase();
}

function identityTokens(companyName: string): readonly string[] {
  return normalise(companyName)
    .split(" ")
    .filter((token) => token.length >= 3 && !legalSuffixes.has(token));
}

function hostMatches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function resultIdentityConfidence(
  companyName: string,
  result: CareerSearchResult,
): "high" | "medium" | null {
  const tokens = identityTokens(companyName);
  if (tokens.length === 0) return null;
  const text = normalise(`${result.title} ${result.description}`);
  const urlText = normalise(new URL(result.url).hostname.replace(/^www\./u, ""));
  const matchedText = tokens.filter((token) => text.includes(token));
  const matchedHost = tokens.filter((token) => urlText.includes(token));
  const required = tokens.length === 1 ? 1 : Math.ceil(tokens.length * 0.6);
  if (matchedText.length >= required && matchedHost.length >= 1) return "high";
  if (matchedText.length === tokens.length) return "high";
  if (matchedText.length >= required || matchedHost.length >= required) return "medium";
  return null;
}

function isCareerResult(result: CareerSearchResult): boolean {
  const url = new URL(result.url);
  const text = normalise(`${url.pathname} ${result.title} ${result.description}`);
  return /\b(careers?|jobs?|vacancies?|opportunities?|join us|graduates?|students?|apprentices?|experienced hires?|professionals?)\b/u.test(
    text,
  );
}

function classifyChannel(result: CareerSearchResult): CareerDiscoveryCandidate["channel"] {
  const url = new URL(result.url);
  const text = normalise(`${url.pathname} ${result.title} ${result.description}`);
  if (/\b(apprentices?|apprenticeships?)\b/u.test(text)) return "apprenticeships";
  if (/\b(early careers?|graduates?|students?|internships?|school leavers?|campus)\b/u.test(text)) {
    return "early_careers";
  }
  if (/\b(professional|experienced hire|experienced professional)\b/u.test(text)) {
    return "professional";
  }
  return "general";
}

function canonicalRoot(url: URL): string {
  return `${url.protocol}//${url.hostname.replace(/^www\./u, "")}`;
}

export function buildCareerSearchQuery(legalName: string): string {
  return `"${legalName.replaceAll('"', "")}" UK careers jobs early careers professional`;
}

export function planCareerSearchResults(
  companyName: string,
  results: readonly CareerSearchResult[],
): CareerSearchPlan {
  let officialWebsiteUrl: string | null = null;
  const candidates = new Map<string, CareerDiscoveryCandidate>();

  for (const result of results) {
    let url: URL;
    try {
      url = new URL(result.url);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
    if (blockedHosts.some((host) => hostMatches(hostname, host))) continue;
    const identityConfidence = resultIdentityConfidence(companyName, result);
    if (!identityConfidence) continue;
    const isAts = atsHosts.some((host) => hostMatches(hostname, host));

    const hostHasIdentity = identityTokens(companyName).some((token) => hostname.includes(token));
    if (!isAts && identityConfidence === "high" && hostHasIdentity && !officialWebsiteUrl) {
      officialWebsiteUrl = canonicalRoot(url);
    }
    if (!isCareerResult(result)) continue;

    const fingerprint = fingerprintCareersUrl(url.toString());
    const confidence =
      identityConfidence === "high" || (isAts && fingerprint.confidence === "high")
        ? "high"
        : "medium";
    const channel = classifyChannel(result);
    const candidate: CareerDiscoveryCandidate = {
      url: url.toString(),
      channel,
      platformHint: fingerprint.platform === "unknown" ? null : platformLabel(fingerprint.platform),
      confidence,
      evidence: [
        `Search result identity ${identityConfidence}: ${result.title}`,
        `Official careers signal classified as ${channel}`,
      ],
    };
    const existing = candidates.get(channel);
    const shouldReplace =
      !existing ||
      (existing.confidence === "medium" && candidate.confidence === "high") ||
      (!existing.platformHint && Boolean(candidate.platformHint));
    if (shouldReplace) candidates.set(channel, candidate);
  }

  return { officialWebsiteUrl, candidates: [...candidates.values()] };
}

export function estimateBraveSearchCost(queryCount: number): number {
  // Brave Search API list price verified 2026-08-21; review before changing discovery version.
  return (queryCount / 1000) * 5;
}
