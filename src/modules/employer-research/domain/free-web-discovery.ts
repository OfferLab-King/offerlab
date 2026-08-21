import { parse } from "node-html-parser";

const suffixes = new Set([
  "and",
  "company",
  "co",
  "group",
  "holdings",
  "limited",
  "ltd",
  "llp",
  "llc",
  "inc",
  "incorporated",
  "plc",
  "the",
  "uk",
]);

function tokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length >= 2 && !suffixes.has(token));
}

export function deriveOfficialHomepageCandidates(companyName: string): readonly string[] {
  const parts = tokens(companyName);
  if (parts.length === 0) return [];
  const joined = parts.join("");
  const hyphenated = parts.join("-");
  if (joined.length < 4 || joined.length > 55) return [];
  return [
    `https://${joined}.co.uk`,
    `https://${joined}.com`,
    `https://${hyphenated}.co.uk`,
    `https://${hyphenated}.com`,
    `https://${joined}.uk`,
  ].filter((value, index, values) => values.indexOf(value) === index);
}

export function homepageHasEmployerIdentity(
  companyName: string,
  finalUrl: string,
  html: string,
): boolean {
  const identityTokens = tokens(companyName);
  if (identityTokens.length === 0) return false;
  const root = parse(html);
  const title = root.querySelector("title")?.text ?? "";
  const description = root.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  const visibleText = `${title} ${description} ${root.querySelector("h1")?.text ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ");
  if (/domain (?:is )?for sale|buy this domain|parked domain|sedo parking/iu.test(html)) {
    return false;
  }
  const hostname = new URL(finalUrl).hostname.toLowerCase().replace(/^www\./u, "");
  const textMatches = identityTokens.filter((token) => visibleText.includes(token)).length;
  const hostMatches = identityTokens.filter((token) => hostname.includes(token)).length;
  const required = identityTokens.length === 1 ? 1 : Math.ceil(identityTokens.length * 0.6);
  return hostMatches >= required && textMatches >= required;
}

export function channelFromCareersUrl(
  url: string,
): "early_careers" | "professional" | "apprenticeships" | "general" {
  const text = new URL(url).pathname.toLowerCase().replace(/[^a-z]+/gu, " ");
  if (/\bapprentices?\b/u.test(text)) return "apprenticeships";
  if (/\b(?:early careers?|graduates?|students?|internships?|campus)\b/u.test(text)) {
    return "early_careers";
  }
  if (/\b(?:professionals?|experienced hires?)\b/u.test(text)) return "professional";
  return "general";
}
