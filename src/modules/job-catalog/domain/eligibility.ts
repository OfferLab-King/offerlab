import type { OpportunityType } from "./taxonomy";

export type EligibilityStatus = "eligible" | "ineligible" | "needs_review";

export type EligibilityReason =
  | "active_job_listing"
  | "source_opportunity_type"
  | "title_early_career"
  | "description_early_career"
  | "title_senior_signal"
  | "description_senior_signal"
  | "experience_years_required"
  | "experienced_hire_statement"
  | "closed_or_expired"
  | "contradictory_evidence"
  | "insufficient_evidence"
  | "postgraduate_uncertain"
  | "uk_location"
  | "uk_remote"
  | "non_uk_location"
  | "location_ambiguous";

export type EligibilityEvaluation = Readonly<{
  status: EligibilityStatus;
  reasons: readonly EligibilityReason[];
  evidence: readonly string[];
  opportunityType: OpportunityType;
}>;

export type EligibilityInput = Readonly<{
  title: string;
  description: string;
  sourceOpportunityType?: OpportunityType | null;
  applicationDeadline: Date | null;
  now?: Date;
}>;

const earlyCareerTitlePatterns: readonly Readonly<{ pattern: RegExp; type: OpportunityType }>[] = [
  { pattern: /training\s+contract/iu, type: "training_contract" },
  { pattern: /vacation\s+scheme/iu, type: "vacation_scheme" },
  {
    pattern: /knowledge\s+transfer\s+partnership|\bktp\b/iu,
    type: "knowledge_transfer_partnership",
  },
  { pattern: /degree\s+apprenticeship/iu, type: "degree_apprenticeship" },
  {
    pattern: /industrial\s+placement|placement\s+(?:year|student)/iu,
    type: "industrial_placement",
  },
  { pattern: /work\s+experience/iu, type: "work_experience" },
  { pattern: /apprenticeship/iu, type: "apprenticeship" },
  { pattern: /internship|intern\b/iu, type: "internship" },
  { pattern: /graduate\s+(?:scheme|programme|program)/iu, type: "graduate_scheme" },
  { pattern: /\bgraduate\b/iu, type: "graduate_job" },
  { pattern: /school\s+leaver/iu, type: "entry_level" },
  { pattern: /entry[- ]level/iu, type: "entry_level" },
  { pattern: /\bjunior\b/iu, type: "junior" },
  { pattern: /immediate[- ]start/iu, type: "immediate_start" },
  { pattern: /volunteer/iu, type: "volunteering" },
];

const postgraduateTitlePattern =
  /postgraduate|post[- ]graduate|phd\s+programme|research\s+programme/iu;

const seniorTitlePatterns: readonly RegExp[] = [
  /\bsenior\b/iu,
  /\blead\b/iu,
  /\bprincipal\b/iu,
  /\bstaff\b/iu,
  /\b(?:line\s+)?manager\b/iu,
  /\bdirector\b/iu,
  /\bhead\s+of\b/iu,
  /\bvp\b|\bvice\s+president\b/iu,
  /\b(?:chief|senior|group)\s+executive\b|\bexecutive\s+director\b/iu,
  /\bexperienced\b/iu,
  /\bchair\b/iu,
  /\bpartner\b/iu,
];

const earlyCareerDescriptionPatterns: readonly RegExp[] = [
  /\brecent\s+graduate\b/iu,
  /\brecently\s+graduated\b/iu,
  /\bfinal[- ]year\b/iu,
  /\bpenultimate\b/iu,
  /\bplacement\s+year\b/iu,
  /\bschool\s+leaver\b/iu,
  /\bearly[- ]career\b/iu,
  /\bno\s+(?:prior\s+)?experience\s+required\b/iu,
  /\bnewly\s+qualified\b/iu,
  /\bentry[- ]level\b/iu,
  /\bgraduate\s+role\b/iu,
  /\bgraduate\s+(?:scheme|programme|program)\b/iu,
];

const seniorDescriptionPatterns: readonly RegExp[] = [
  /\bexperienced\s+hire\b/iu,
  /\bexperienced\s+professional\b/iu,
  /\bexperienced\s+(?:writer|designer|developer|engineer|analyst|candidate)\b/iu,
  /\bsenior\s+(?:leadership|management|team)\b/iu,
];

const experienceYearsPattern =
  /\b(\d{1,2})\s*\+?\s*(?:to\s+\d{1,2}\s*\+?\s*)?years['’]?\s*(?:of)?\s*(?:relevant|professional|industry|direct|practical|work)?\s*experience\b/iu;

export function evaluateEligibility(input: EligibilityInput): EligibilityEvaluation {
  const reasons: EligibilityReason[] = ["active_job_listing"];
  const evidence: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();

  const now = input.now ?? new Date();
  if (input.applicationDeadline && input.applicationDeadline.getTime() < now.getTime()) {
    return {
      status: "ineligible",
      opportunityType: "unknown",
      reasons: ["closed_or_expired"],
      evidence: ["Application deadline has passed."],
    };
  }

  let opportunityType: OpportunityType = "unknown";

  const postgraduateTitle = title.match(postgraduateTitlePattern);
  if (postgraduateTitle) {
    opportunityType = "postgraduate_opportunity";
    evidence.push(exactPhrase(title, postgraduateTitle[0]!));
    reasons.push("postgraduate_uncertain");
  }

  const titleEarly = earlyCareerTitlePatterns.find(({ pattern }) => pattern.test(title));
  if (titleEarly) {
    opportunityType = titleEarly.type;
    const match = title.match(titleEarly.pattern);
    if (match) evidence.push(exactPhrase(title, match[0]!));
    reasons.push("title_early_career");
  }

  const descriptionEarly = earlyCareerDescriptionPatterns.find((pattern) =>
    pattern.test(description),
  );
  if (descriptionEarly) {
    const match = description.match(descriptionEarly);
    if (match) {
      evidence.push(exactPhrase(description, match[0]!));
      if (opportunityType === "unknown") {
        opportunityType = descriptionOpportunityType(match[0]!);
      }
    }
    reasons.push("description_early_career");
  }

  const titleSenior = seniorTitlePatterns.filter((pattern) => pattern.test(title));
  const descriptionSenior = seniorDescriptionPatterns.filter((pattern) =>
    pattern.test(description),
  );
  const experienceMatch = description.match(experienceYearsPattern);
  if (experienceMatch) {
    evidence.push(exactPhrase(description, experienceMatch[0]!));
    reasons.push("experience_years_required");
  }

  if (titleSenior.length > 0) {
    const match = title.match(titleSenior[0]!);
    if (match) evidence.push(exactPhrase(title, match[0]!));
    reasons.push("title_senior_signal");
  }
  if (descriptionSenior.length > 0) {
    const match = description.match(descriptionSenior[0]!);
    if (match) evidence.push(exactPhrase(description, match[0]!));
    reasons.push("description_senior_signal");
  }

  if (input.sourceOpportunityType && input.sourceOpportunityType !== "unknown") {
    if (opportunityType === "unknown") opportunityType = input.sourceOpportunityType;
    reasons.push("source_opportunity_type");
  }

  return {
    status: "eligible",
    opportunityType,
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)].slice(0, 6),
  };
}

function exactPhrase(source: string, match: string): string {
  const index = source.toLowerCase().indexOf(match.toLowerCase());
  if (index < 0) return match.slice(0, 200);
  return source
    .slice(index, index + match.length)
    .trim()
    .slice(0, 200);
}

function descriptionOpportunityType(match: string): OpportunityType {
  if (/apprenticeship/iu.test(match)) return "degree_apprenticeship";
  if (/intern/iu.test(match)) return "internship";
  if (/placement/iu.test(match)) return "industrial_placement";
  if (/work experience/iu.test(match)) return "work_experience";
  if (/vacation/iu.test(match)) return "vacation_scheme";
  if (/graduate/iu.test(match)) return "graduate_job";
  if (/entry[- ]level/iu.test(match)) return "entry_level";
  if (/junior/iu.test(match)) return "junior";
  return "other_early_career";
}

export const eligibilityStatusLabels: Readonly<Record<EligibilityStatus, string>> = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  needs_review: "Needs review",
};

export const eligibilityReasonLabels: Readonly<Record<EligibilityReason, string>> = {
  active_job_listing: "Active role from a reviewed employer source",
  source_opportunity_type: "Source-provided opportunity type",
  title_early_career: "Early-career expression in the title",
  description_early_career: "Early-career eligibility stated in the description",
  title_senior_signal: "Senior-level role",
  description_senior_signal: "Experienced-hire language in the description",
  experience_years_required: "Prior experience required",
  experienced_hire_statement: "Explicitly an experienced-hire role",
  closed_or_expired: "Application closed or expired",
  contradictory_evidence: "Early-career and senior signals conflict",
  insufficient_evidence: "Insufficient listing evidence",
  postgraduate_uncertain: "Postgraduate programme without confirmed career opportunity",
  uk_location: "UK location confirmed",
  uk_remote: "Remote role explicitly available within the UK",
  non_uk_location: "No UK location in the official listing",
  location_ambiguous: "Location requires administrator review",
};
