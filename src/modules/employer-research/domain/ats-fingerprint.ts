/**
 * Deterministic ATS/platform fingerprinting for the Top 1,000 source-discovery
 * programme. Pure URL/name classification: no network, no LLM. A fingerprint is
 * evidence for a `job_source_candidate`, never proof of a live source.
 */

export const atsPlatforms = [
  "workday",
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "oracle",
  "successfactors",
  "tal",
  "icims",
  "avature",
  "taleo",
  "teamtailor",
  "personio",
  "workable",
  "pageup",
  "recruitee",
  "eightfold",
  "custom",
  "unknown",
] as const;

export type AtsPlatform = (typeof atsPlatforms)[number];

export type FingerprintConfidence = "high" | "medium" | "low";

export type UrlFingerprint = Readonly<{
  platform: AtsPlatform;
  confidence: FingerprintConfidence;
  evidence: readonly string[];
}>;

export const UNKNOWN_FINGERPRINT: UrlFingerprint = {
  platform: "unknown",
  confidence: "low",
  evidence: [],
};

export const platformLabels: Readonly<Record<AtsPlatform, string>> = {
  workday: "Workday",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  oracle: "Oracle",
  successfactors: "SAP SuccessFactors",
  tal: "TAL / tal.net",
  icims: "iCIMS",
  avature: "Avature",
  taleo: "Oracle Taleo",
  teamtailor: "Teamtailor",
  personio: "Personio",
  workable: "Workable",
  pageup: "PageUp",
  recruitee: "Recruitee",
  eightfold: "Eightfold",
  custom: "Custom / direct",
  unknown: "Not researched",
};

export function platformLabel(platform: AtsPlatform): string {
  return platformLabels[platform];
}

type HostRule = Readonly<{ platform: AtsPlatform; pattern: RegExp; note: string }>;

const HOST_RULES: readonly HostRule[] = [
  {
    platform: "workday",
    pattern: /^[^.]+\.(?:wd\d+\.)?myworkdayjobs\.com$/u,
    note: "employer tenant on myworkdayjobs.com",
  },
  {
    platform: "workday",
    pattern: /^[^.]+\.myworkday\.com$/u,
    note: "employer tenant on myworkday.com",
  },
  {
    platform: "greenhouse",
    pattern: /^boards\.(?:eu\.)?greenhouse\.io$/u,
    note: "Greenhouse job board host",
  },
  {
    platform: "greenhouse",
    pattern: /^grnh\.se$/u,
    note: "Greenhouse short link host",
  },
  {
    platform: "lever",
    pattern: /^jobs\.lever\.co$/u,
    note: "Lever job board host",
  },
  {
    platform: "ashby",
    pattern: /^jobs\.ashbyhq\.com$/u,
    note: "Ashby job board host",
  },
  {
    platform: "smartrecruiters",
    pattern: /^jobs\.smartrecruiters\.com$/u,
    note: "SmartRecruiters job board host",
  },
  {
    platform: "oracle",
    pattern: /^[^.]+\.oraclecloud\.com$/u,
    note: "Oracle Cloud careers/recruiting host",
  },
  {
    platform: "successfactors",
    pattern: /^[^.]+\.successfactors\.(?:eu|com)$/u,
    note: "SAP SuccessFactors tenant",
  },
  {
    platform: "successfactors",
    pattern: /^[^.]+\.sapsf\.com$/u,
    note: "SAP SuccessFactors careers host",
  },
  {
    platform: "tal",
    pattern: /(?:^|\.)tal\.net$/u,
    note: "TAL job board host",
  },
  {
    platform: "icims",
    pattern: /(?:^|\.)icims\.com$/u,
    note: "iCIMS job board host",
  },
  {
    platform: "avature",
    pattern: /(?:^|\.)avature\.net$/u,
    note: "Avature careers host",
  },
  {
    platform: "taleo",
    pattern: /(?:^|\.)taleo\.(?:net|com)$/u,
    note: "Oracle Taleo job board host",
  },
  {
    platform: "teamtailor",
    pattern: /(?:^|\.)teamtailor\.com$/u,
    note: "Teamtailor careers host",
  },
  {
    platform: "personio",
    pattern: /^jobs\.personio\.(?:com|de)$/u,
    note: "Personio job board host",
  },
  {
    platform: "workable",
    pattern: /^[^.]+\.workable\.com$/u,
    note: "Workable job board host",
  },
  {
    platform: "pageup",
    pattern: /(?:^|\.)pageuppeople\.com$/u,
    note: "PageUp careers host",
  },
  {
    platform: "recruitee",
    pattern: /(?:^|\.)recruitee\.com$/u,
    note: "Recruitee careers host",
  },
  {
    platform: "eightfold",
    pattern: /(?:^|\.)eightfold(?:ai)?\.(?:ai|com)$/u,
    note: "Eightfold careers host",
  },
];

const PATH_MARKERS: readonly { marker: string; platform: AtsPlatform; note: string }[] = [
  { marker: "myworkdayjobs", platform: "workday", note: "workday marker in path" },
  { marker: "taleo", platform: "taleo", note: "taleo marker in path" },
  {
    marker: "smartrecruiters",
    platform: "smartrecruiters",
    note: "smartrecruiters marker in path",
  },
  { marker: "greenhouse", platform: "greenhouse", note: "greenhouse marker in path" },
  { marker: "successfactors", platform: "successfactors", note: "successfactors marker in path" },
  { marker: "sapsf", platform: "successfactors", note: "sapsf marker in path" },
  { marker: "icims", platform: "icims", note: "icims marker in path" },
  { marker: "avature", platform: "avature", note: "avature marker in path" },
  { marker: "pageuppeople", platform: "pageup", note: "pageup marker in path" },
  { marker: "teamtailor", platform: "teamtailor", note: "teamtailor marker in path" },
  { marker: "recruitee", platform: "recruitee", note: "recruitee marker in path" },
  { marker: "eightfold", platform: "eightfold", note: "eightfold marker in path" },
  { marker: "oraclecloud", platform: "oracle", note: "oracle cloud marker in path" },
];

export function fingerprintCareersUrl(value: string): UrlFingerprint {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return UNKNOWN_FINGERPRINT;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return UNKNOWN_FINGERPRINT;
  const hostname = url.hostname.replace(/^www\./u, "").toLowerCase();
  if (hostname.length === 0) return UNKNOWN_FINGERPRINT;

  for (const rule of HOST_RULES) {
    if (rule.pattern.test(hostname)) {
      return {
        platform: rule.platform,
        confidence: "high",
        evidence: [`host ${hostname} matches ${rule.note}`],
      };
    }
  }

  const path = `${url.pathname}${url.search}`.toLowerCase();
  for (const marker of PATH_MARKERS) {
    if (path.includes(marker.marker)) {
      return {
        platform: marker.platform,
        confidence: "medium",
        evidence: [`path contains "${marker.marker}" (${marker.note})`],
      };
    }
  }

  return UNKNOWN_FINGERPRINT;
}

/**
 * Normalizes research workbook "ATS / Platform" text to a platform key.
 * Research text is evidence, never proof of a live source. Rule order matters:
 * narrower matches (taleo, successfactors, tal.net) must win over broader ones.
 */
export function atsPlatformFromResearchText(value: string | null | undefined): AtsPlatform {
  const text = (value ?? "").trim().toLowerCase();
  if (text.length === 0 || text === "not researched" || text === "n/a") return "unknown";
  if (text.includes("smartrecruiters")) return "smartrecruiters";
  if (text.includes("successfactors") || text.includes("sapsf")) return "successfactors";
  if (text.includes("taleo")) return "taleo";
  if (text.includes("workday")) return "workday";
  if (text.includes("greenhouse")) return "greenhouse";
  if (text.includes("teamtailor")) return "teamtailor";
  if (text.includes("eightfold")) return "eightfold";
  if (text.includes("avature")) return "avature";
  if (text.includes("pageup") || text.includes("page up")) return "pageup";
  if (text.includes("personio")) return "personio";
  if (text.includes("workable")) return "workable";
  if (text.includes("recruitee")) return "recruitee";
  if (text.includes("icims") || text.includes("icim")) return "icims";
  if (text.includes("lever")) return "lever";
  if (text.includes("ashby")) return "ashby";
  if (text.includes("oracle")) return "oracle";
  if (text.includes("tal.net") || /\btal\b/u.test(text)) return "tal";
  if (text.includes("custom") || text.includes("direct") || text.includes("html")) return "custom";
  return "unknown";
}

/** Maps a platform to the crawler source_type used when promoting a candidate. */
export function sourceTypeForPlatform(platform: AtsPlatform): string {
  switch (platform) {
    case "workday":
    case "greenhouse":
    case "lever":
    case "ashby":
    case "smartrecruiters":
    case "workable":
    case "teamtailor":
      return platform;
    case "unknown":
      return "unknown";
    default:
      return "custom";
  }
}
