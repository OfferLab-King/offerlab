/**
 * Deterministic careers-URL discovery from an employer homepage. Pure HTML
 * link scoring: no network, no LLM. The discovered URL feeds
 * `job_source_candidate`; it never activates crawling.
 */

import { parse } from "node-html-parser";

import { canonicalizeJobUrl, urlHostname } from "../../job-catalog/domain/urls";
import { fingerprintCareersUrl } from "./ats-fingerprint";

export type CareersLinkCandidate = Readonly<{
  url: string;
  host: string;
  score: number;
  matched: readonly string[];
}>;

const CAREERS_MARKERS: readonly { marker: string; score: number }[] = [
  { marker: "careers", score: 4 },
  { marker: "join-us", score: 3 },
  { marker: "joinus", score: 3 },
  { marker: "working-here", score: 3 },
  { marker: "jobs", score: 2 },
  { marker: "vacancies", score: 2 },
  { marker: "recruitment", score: 1 },
  { marker: "graduate", score: 1 },
  { marker: "early-careers", score: 2 },
  { marker: "students", score: 1 },
];

const EXCLUDED_MARKERS: readonly string[] = [
  "login",
  "sign-in",
  "signin",
  "register",
  "cookie",
  "privacy",
  "terms",
  "faq",
  "help",
  "contact",
  "apply",
];

function scoreUrl(urlText: string): { score: number; matched: readonly string[] } {
  const normalized = urlText.toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const { marker, score: markerScore } of CAREERS_MARKERS) {
    if (normalized.includes(marker)) {
      score += markerScore;
      matched.push(marker);
    }
  }
  for (const marker of EXCLUDED_MARKERS) {
    if (normalized.includes(marker)) {
      score -= 2;
      matched.push(`excluded:${marker}`);
    }
  }
  return { score, matched };
}

export function extractCareersUrls(html: string, baseUrl: string): CareersLinkCandidate[] {
  let root: ReturnType<typeof parse>;
  try {
    root = parse(html);
  } catch {
    return [];
  }
  const baseHost = urlHostname(baseUrl);
  const seen = new Set<string>();
  const candidates: CareersLinkCandidate[] = [];
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const text = anchor.text.trim().replace(/\s+/gu, " ").toLowerCase();
    const urlText = url.toString();
    const scored = scoreUrl(urlText);
    const textScored =
      text.length > 0 && text.length <= 40 ? scoreUrl(text) : { score: 0, matched: [] as string[] };
    const best = scored.score >= textScored.score ? scored : textScored;
    if (best.score < 2) continue;
    const canonical = canonicalizeJobUrl(urlText);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    const host = urlHostname(canonical) ?? "";
    let score = best.score;
    if (host === baseHost) score += 1;
    if (fingerprintCareersUrl(canonical).platform !== "unknown") score += 2;
    candidates.push({ url: canonical, host, score, matched: best.matched });
  }
  return candidates.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, 10);
}

export type HomepageDiscoveryResult = Readonly<{
  candidateUrl: string;
  fingerprintPlatform: string;
  fingerprintConfidence: string;
  status: string;
  evidence: readonly string[];
}>;

export function planHomepageCareersUrl(
  html: string,
  homepageUrl: string,
): HomepageDiscoveryResult | null {
  const candidates = extractCareersUrls(html, homepageUrl);
  if (candidates.length === 0) return null;
  const best = candidates[0]!;
  const fingerprint = fingerprintCareersUrl(best.url);
  return {
    candidateUrl: best.url,
    fingerprintPlatform: fingerprint.platform,
    fingerprintConfidence: fingerprint.confidence,
    status: fingerprint.platform === "unknown" ? "candidate_found" : "platform_identified",
    evidence: [`homepage link: ${best.host} (${best.matched.join(", ")})`],
  };
}
