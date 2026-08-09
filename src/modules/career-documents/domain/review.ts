import { z } from "zod";
import type { CareerDocumentKind } from "./career-document";

const strengthSchema = z
  .object({
    evidence: z.string().trim().min(1).max(500),
    requirement: z.string().trim().min(1).max(300),
  })
  .strict();

const actionSchema = z
  .object({
    category: z.enum([
      "Targeting",
      "Evidence",
      "Impact",
      "Clarity",
      "Structure",
      "Voice",
      "Readability",
    ]),
    observation: z.string().trim().min(1).max(600),
    suggestion: z.string().trim().min(1).max(800),
  })
  .strict();

export const careerReviewSchema = z
  .object({
    documentChecks: z
      .object({
        length: z.string().trim().min(1).max(300),
        readability: z.string().trim().min(1).max(300),
        specificity: z.string().trim().min(1).max(300),
        targeting: z.string().trim().min(1).max(300),
      })
      .strict(),
    matchedRequirements: z.array(z.string().trim().min(1).max(200)).max(5),
    missingRequirements: z.array(z.string().trim().min(1).max(200)).max(10),
    priorityActions: z.array(actionSchema).min(1).max(8),
    strengths: z.array(strengthSchema).max(5),
    suggestedContent: z.string().trim().min(40).max(60_000).nullable(),
    summary: z.string().trim().min(1).max(600),
  })
  .strict();

export type CareerReview = z.infer<typeof careerReviewSchema>;

export type CareerReviewInput = Readonly<{
  contentText: string;
  jobDescription: string;
  kind: CareerDocumentKind;
  targetCompany: string;
  targetRole: string;
}>;

export type CareerReviewProvider = Readonly<{
  id: string;
  mode: "local" | "model";
  review(input: CareerReviewInput): Promise<
    Readonly<{
      review: CareerReview;
      usage: Readonly<{ inputTokens: number; latencyMs: number; outputTokens: number }> | null;
    }>
  >;
}>;

const stopWords = new Set([
  "ability",
  "about",
  "across",
  "advanced",
  "advantageous",
  "after",
  "also",
  "and",
  "are",
  "been",
  "being",
  "build",
  "candidate",
  "company",
  "demonstrated",
  "excellent",
  "experience",
  "familiarity",
  "for",
  "from",
  "have",
  "highly",
  "into",
  "job",
  "key",
  "knowledge",
  "languages",
  "looking",
  "more",
  "our",
  "proficiency",
  "proven",
  "required",
  "requirements",
  "role",
  "skills",
  "strong",
  "that",
  "the",
  "their",
  "this",
  "through",
  "tools",
  "using",
  "will",
  "with",
  "work",
  "working",
  "you",
  "your",
]);

const requirementSignal =
  /\b(?:essential|required|must|need|proven|experience|proficien|familiar|knowledge|skill|ability|confident|advantage|desirable|responsib|you will|you'll)\b/iu;

const evidenceActivitySignal =
  /\b(?:analys(?:e|ed|is|ing)|built|collaborat|created|deliver(?:ed|y|ing)|develop(?:ed|ment|ing)?|designed|document(?:ed|ation|ing)?|experience|implemented|improved|led|managed|presented|project|prototyp|research|responsib|service|support(?:ed|ing)?|test(?:ed|ing)?|used|using|worked|wrote)\b/iu;

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, " ").trim();
}

const recognisedSkills = [
  { label: "SQL", patterns: [/\bsql\b/iu, /structured query language/iu] },
  { label: "PostgreSQL", patterns: [/\bpostgres(?:ql)?\b/iu] },
  { label: "Python", patterns: [/\bpython\b/iu, /\bpandas\b/iu, /\bnumpy\b/iu] },
  { label: "R", patterns: [/\br programming\b/iu, /\br language\b/iu] },
  { label: "Power BI", patterns: [/\bpower\s*bi\b/iu, /\bdax\b/iu] },
  { label: "Tableau", patterns: [/\btableau\b/iu] },
  { label: "Looker", patterns: [/\blooker\b/iu] },
  { label: "Excel", patterns: [/\bexcel\b/iu, /pivot tables?/iu, /\bvlookup\b/iu] },
  { label: "data visualisation", patterns: [/data visuali[sz]ation/iu, /\bdashboards?\b/iu] },
  { label: "data analysis", patterns: [/data analys(?:is|t|tics)/iu, /statistical analysis/iu] },
  { label: "TypeScript", patterns: [/\btypescript\b/iu] },
  { label: "JavaScript", patterns: [/\bjavascript\b/iu] },
  { label: "React", patterns: [/\breact(?:\.js)?\b/iu] },
  { label: "Kubernetes", patterns: [/\bkubernetes\b/iu, /\bk8s\b/iu] },
  { label: "accessibility", patterns: [/\baccessibility\b/iu, /\bwcag\b/iu] },
  { label: "testing", patterns: [/\btesting\b/iu, /\btest automation\b/iu] },
  { label: "cloud", patterns: [/\baws\b/iu, /\bazure\b/iu, /google cloud/iu] },
  { label: "stakeholder communication", patterns: [/\bstakeholders?\b/iu] },
  { label: "project management", patterns: [/project management/iu, /\bagile\b/iu] },
] as const;

function terms(value: string): string[] {
  return (
    value
      .toLowerCase()
      .match(/[a-z][a-z+#.\/-]{2,}/gu)
      ?.map((term) => term.replace(/[.,/]+$/u, ""))
      .filter((term) => !stopWords.has(term)) ?? []
  );
}

function cleanRequirement(value: string): string {
  return value
    .replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.;:,]+$/u, "")
    .slice(0, 200)
    .trim();
}

function recognisedSkillsIn(value: string) {
  return recognisedSkills.filter((skill) => skill.patterns.some((pattern) => pattern.test(value)));
}

function isUsefulRequirement(value: string): boolean {
  return (
    recognisedSkillsIn(value).length > 0 ||
    (requirementSignal.test(value) && terms(value).length >= 2)
  );
}

function requirementStatements(value: string): string[] {
  const fragments = value
    .replace(/\r\n?/gu, "\n")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z•*-])/u)
    .map(cleanRequirement)
    .filter((line) => line.length >= 8 && isUsefulRequirement(line));
  const expanded = fragments.flatMap((line) => {
    const skills = recognisedSkillsIn(line);
    return skills.length >= 2 && !/\b(?:such as|including|like|or|either|any of)\b/iu.test(line)
      ? skills.map(({ label }) => label)
      : [line];
  });
  const unique = [...new Map(expanded.map((line) => [normalize(line), line])).values()];
  return unique
    .map((line, index) => ({
      index,
      line,
      score:
        (requirementSignal.test(line) ? 4 : 0) +
        Math.min(recognisedSkillsIn(line).length * 3, 6) +
        (line.length <= 160 ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 10)
    .map(({ line }) => line);
}

function requirementIsRepresented(requirement: string, content: string): boolean {
  return Boolean(evidenceExcerptForRequirement(requirement, content));
}

function requirementEvidenceMatches(requirement: string, evidence: string): boolean {
  const skills = recognisedSkillsIn(requirement);
  if (skills.length) {
    const matches = skills.filter((skill) =>
      skill.patterns.some((pattern) => pattern.test(evidence)),
    );
    return /\b(?:or|either|any of)\b/iu.test(requirement)
      ? matches.length > 0
      : matches.length === skills.length;
  }
  const requirementWords = [...new Set(terms(requirement))];
  const evidenceWords = new Set(terms(evidence));
  const overlap = requirementWords.filter((word) => evidenceWords.has(word)).length;
  return overlap >= Math.max(2, Math.ceil(Math.min(requirementWords.length, 5) * 0.5));
}

function meaningfulEvidence(requirement: string, evidence: string): boolean {
  const evidenceTerms = terms(evidence);
  const requirementTerms = new Set(terms(requirement));
  const additionalTerms = evidenceTerms.filter((term) => !requirementTerms.has(term));
  const keywordList =
    /^\s*(?:skills?|technical skills?|technologies|tools|competenc(?:y|ies))\s*[:|-]/iu.test(
      evidence,
    );
  return (
    !keywordList &&
    evidenceTerms.length >= 2 &&
    additionalTerms.length > 0 &&
    (additionalTerms.length >= 2 || evidenceActivitySignal.test(evidence)) &&
    requirementEvidenceMatches(requirement, evidence)
  );
}

function hasContactDetails(content: string): boolean {
  return /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu.test(content) || /\b0\d{9,10}\b/u.test(content);
}

function evidenceExcerptForRequirement(requirement: string, content: string): string | null {
  const lines = content
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (meaningfulEvidence(requirement, line)) {
      return line.length <= 500 ? line : line.slice(0, 500);
    }
  }
  return null;
}

function localReview(input: CareerReviewInput): CareerReview {
  const requirements = requirementStatements(input.jobDescription);
  const matchedRequirements = requirements
    .filter((requirement) => requirementIsRepresented(requirement, input.contentText))
    .slice(0, 5);
  const missingRequirements = requirements
    .filter((requirement) => !requirementIsRepresented(requirement, input.contentText))
    .slice(0, 5);
  const wordCount = input.contentText.trim().split(/\s+/u).length;
  const quantified = /(?:£|\$|€)?\d[\d,.]*%?/u.test(input.contentText);
  const paragraphs = input.contentText
    .trim()
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const opening = paragraphs[0] ?? input.contentText.trim().slice(0, 600);
  const closing = input.contentText.trim().slice(-600);
  const openingRoleMentioned = opening.toLowerCase().includes(input.targetRole.toLowerCase());
  const openingCompanyMentioned = opening.toLowerCase().includes(input.targetCompany.toLowerCase());
  const hasMotivation =
    /\b(?:attracted|because|drawn|excited|interested|mission|motivated|values|why)\b/iu.test(
      input.contentText,
    );
  const genericLanguage =
    /\b(?:dynamic|fast-paced|hard-working|highly motivated|passionate|results-driven|team player)\b/iu.test(
      input.contentText,
    );
  const hasClosing =
    /\b(?:best wishes|kind regards|look forward|thank you|thanks|yours faithfully|yours sincerely)\b/iu.test(
      closing,
    );
  const headings =
    /(?:^|\n)(?:professional profile|summary|skills|experience|education|projects)\b/imu;
  const priorityActions: CareerReview["priorityActions"] = [];

  if (input.kind === "cover_letter" && (!openingRoleMentioned || !openingCompanyMentioned)) {
    priorityActions.push({
      category: "Targeting",
      observation: "The opening does not clearly name both the target role and organisation.",
      suggestion: `Make the connection to ${input.targetRole} at ${input.targetCompany} explicit near the opening, using only claims supported by your existing evidence.`,
    });
  }
  if (missingRequirements.length) {
    const evidenceLabel = input.kind === "cv" ? "CV" : "cover-letter";
    priorityActions.push({
      category: "Evidence",
      observation: `${missingRequirements.length} key requirement${missingRequirements.length === 1 ? " is" : "s are"} not yet supported by clear ${evidenceLabel} evidence, including “${missingRequirements.slice(0, 2).join("” and “")}”.`,
      suggestion: `For each genuine match, add one example to the ${evidenceLabel} that names what you did, the tool or method used, and the result or decision it supported. If you do not yet have the experience, keep the gap honest and use the development options below to build evidence.`,
    });
  }
  if (matchedRequirements.length) {
    priorityActions.push({
      category: "Evidence",
      observation: `${matchedRequirements.length} assessed requirement${matchedRequirements.length === 1 ? " has" : "s have"} relevant wording in the document, but wording alone may not prove capability.`,
      suggestion:
        input.kind === "cv"
          ? "Keep the strongest matching example prominent. Use a concise action–method–outcome bullet so a reader can understand your level of responsibility, not only the skill name."
          : "Use one specific example to connect the requirement to your contribution and the decision or result it supported. Keep the wording in your natural voice.",
    });
  }
  if (input.kind === "cv" && !quantified) {
    priorityActions.push({
      category: "Impact",
      observation: "The document contains little quantified evidence of scale, change or outcome.",
      suggestion:
        "Where your records support it, add truthful measures such as volume, time saved, users served or quality improvement. Do not estimate or invent a number.",
    });
  }
  if (input.kind === "cv" && !headings.test(input.contentText)) {
    priorityActions.push({
      category: "Structure",
      observation: "Common CV section headings were not detected in the extracted text.",
      suggestion:
        "Use conventional, descriptive headings so a recruiter and parsing software can find profile, skills, experience, projects and education quickly.",
    });
  }
  if (input.kind === "cover_letter" && !hasMotivation) {
    priorityActions.push({
      category: "Clarity",
      observation:
        "The letter does not yet make a specific reason for wanting this role or organisation clear.",
      suggestion:
        "Explain one truthful reason for this role or organisation, then connect it to an experience or interest already present in your evidence.",
    });
  }
  if (input.kind === "cover_letter" && paragraphs.length < 3) {
    priorityActions.push({
      category: "Structure",
      observation:
        "The letter has too little paragraph separation to make its opening, evidence and close easy to follow.",
      suggestion:
        "Give each paragraph one purpose: opening and motivation, specific evidence, then a concise close. Do not add padding to reach a template length.",
    });
  }
  if (input.kind === "cover_letter" && genericLanguage) {
    priorityActions.push({
      category: "Voice",
      observation:
        "Some wording sounds generic and may not show how you actually work or contribute.",
      suggestion:
        "Replace broad labels with one concrete action, method or decision from your own experience, and keep the sentence easy to say aloud.",
    });
  }
  const ideal: readonly [number, number] = input.kind === "cv" ? [350, 1_200] : [250, 600];
  if (wordCount < ideal[0] || wordCount > ideal[1]) {
    priorityActions.push({
      category: "Readability",
      observation: `This version contains about ${wordCount} words, outside the usual working range for this review (${ideal[0]}-${ideal[1]}).`,
      suggestion:
        wordCount > ideal[1]
          ? "Remove repetition and keep the strongest role-relevant evidence prominent."
          : "Check that the document contains enough specific evidence to support the main role requirements.",
    });
  }
  if (input.kind === "cover_letter" && !hasClosing) {
    priorityActions.push({
      category: "Clarity",
      observation: "The closing does not clearly thank the reader or state the intended next step.",
      suggestion:
        "End with a brief, natural close that thanks the reader and expresses interest in discussing the role, without making an unsupported claim.",
    });
  }
  if (!priorityActions.length) {
    priorityActions.push({
      category: "Clarity",
      observation:
        "The basic targeting, structure and evidence checks did not find a high-severity issue.",
      suggestion:
        "Read every line against the target role and remove anything that does not improve relevance, credibility or understanding.",
    });
  }

  const strengths: CareerReview["strengths"] = matchedRequirements.map((requirement) => ({
    evidence: evidenceExcerptForRequirement(requirement, input.contentText)!,
    requirement,
  }));
  const assessedCount = matchedRequirements.length + missingRequirements.length;
  const selectedPriorityActions = priorityActions.slice(0, 8);

  return careerReviewSchema.parse({
    documentChecks: {
      length: `Approximately ${wordCount} words.`,
      readability:
        input.kind === "cv" && headings.test(input.contentText)
          ? "Recognisable CV section headings are present."
          : input.kind === "cover_letter" && paragraphs.length >= 3
            ? "The letter has separate paragraphs for a readable review."
            : "Review the document in its original layout as well as this extracted-text view.",
      specificity: quantified
        ? "At least one numeric detail is present; verify that every number remains accurate."
        : "No clear numeric evidence was detected.",
      targeting:
        input.kind === "cv"
          ? "A CV does not need to name the employer. Targeting is assessed through the relevance and prominence of truthful role evidence."
          : openingRoleMentioned && openingCompanyMentioned
            ? "The opening names the target role and organisation."
            : "The target role or organisation is not yet explicit in the opening of the cover letter.",
    },
    matchedRequirements,
    missingRequirements,
    priorityActions: selectedPriorityActions,
    strengths,
    suggestedContent: null,
    summary: assessedCount
      ? `${matchedRequirements.length} of ${assessedCount} assessed role requirements have supporting wording or evidence in this version; ${missingRequirements.length} need a truthful evidence check or development plan.`
      : "The saved job description did not contain enough clear requirements for a document coverage measure. Review the target text and request a new review.",
  });
}

export const localCareerReviewProvider: CareerReviewProvider = {
  id: "offerlab-career-rubric-v2",
  mode: "local",
  async review(input) {
    return { review: localReview(input), usage: null };
  },
};

export function validateCareerProviderReview(
  candidate: unknown,
  sourceContent: string,
  jobDescription?: string,
  context?: Readonly<{ kind: CareerDocumentKind; targetCompany: string }>,
): CareerReview {
  const review = careerReviewSchema.parse(candidate);
  const outputText = JSON.stringify(review);
  const prohibitedOutcomeClaim = [
    /\b(?:ats|applicant tracking system)\b.{0,50}\b(?:score|rating|match|percentage|percent|pass(?:ing)?|fail(?:ing)?)\b/iu,
    /\b(?:match|fit|suitability)\s*(?:score|rating|percentage|percent|%)\b/iu,
    /\b(?:likely|unlikely|chance|probability|odds|guarantee(?:d|s)?|will)\b.{0,50}\b(?:interview|hire|hired|offer)\b/iu,
    /\b(?:interview|hire|hired|offer)\b.{0,50}\b(?:chance|probability|odds|guarantee(?:d|s)?)\b/iu,
  ].some((pattern) => pattern.test(outputText));
  if (prohibitedOutcomeClaim) {
    throw new Error("career_review_prohibited_outcome_claim");
  }
  const normalizedSource = normalize(sourceContent);
  const allRequirements = [...review.matchedRequirements, ...review.missingRequirements];
  const normalizedRequirements = allRequirements.map(normalize);
  if (new Set(normalizedRequirements).size !== normalizedRequirements.length) {
    throw new Error("career_review_requirement_duplicates");
  }
  if (allRequirements.length > 10) {
    throw new Error("career_review_requirement_set_too_large");
  }
  if (jobDescription) {
    const normalizedJob = normalize(jobDescription);
    if (allRequirements.some((requirement) => !normalizedJob.includes(normalize(requirement)))) {
      throw new Error("career_review_requirement_absent_from_target");
    }
    const availableRequirements = requirementStatements(jobDescription);
    if (availableRequirements.length >= 6 && allRequirements.length < 6) {
      throw new Error("career_review_requirement_set_incomplete");
    }
  }
  if (allRequirements.some((requirement) => !isUsefulRequirement(requirement))) {
    throw new Error("career_review_requirement_not_informative");
  }
  const matched = new Set(review.matchedRequirements.map(normalize));
  const strengthened = new Set(review.strengths.map(({ requirement }) => normalize(requirement)));
  if (
    review.strengths.some(
      (strength) =>
        !normalizedSource.includes(normalize(strength.evidence)) ||
        !matched.has(normalize(strength.requirement)) ||
        !meaningfulEvidence(strength.requirement, strength.evidence),
    )
  ) {
    throw new Error("career_review_strength_ungrounded");
  }
  if (review.matchedRequirements.some((requirement) => !strengthened.has(normalize(requirement)))) {
    throw new Error("career_review_matched_requirement_without_evidence");
  }
  if (review.strengths.length !== review.matchedRequirements.length) {
    throw new Error("career_review_strength_count_mismatch");
  }
  if (
    review.strengths.some(
      (strength) => !requirementEvidenceMatches(strength.requirement, strength.evidence),
    )
  ) {
    throw new Error("career_review_strength_ungrounded");
  }
  const missing = new Set(review.missingRequirements.map(normalize));
  if ([...matched].some((requirement) => missing.has(requirement))) {
    throw new Error("career_review_requirement_status_conflict");
  }
  if (context?.kind === "cv") {
    const company = normalize(context.targetCompany);
    const targetingAdvice = review.priorityActions
      .filter(({ category }) => category === "Targeting")
      .map(({ observation, suggestion }) => normalize(`${observation} ${suggestion}`))
      .join(" ");
    if (
      (company && targetingAdvice.includes(company)) ||
      /\b(?:name|mention|add|include)\b.{0,40}\b(?:company|employer|organisation|organization)\b/iu.test(
        targetingAdvice,
      )
    ) {
      throw new Error("career_review_cv_company_targeting_unsupported");
    }
  }
  // Complete model-written replacements remain intentionally disabled in v2. Length and numeric
  // checks cannot prove that non-numeric experience, qualifications or outcomes came from the
  // member's source. Re-enable only with a versioned, source-anchored edit contract.
  if (review.suggestedContent) throw new Error("career_review_suggestion_unsupported");
  return review;
}

export function careerEvidenceCoverage(review: CareerReview): Readonly<{
  assessed: number;
  evidenced: number;
  label: "Early evidence" | "Moderate evidence" | "Strong evidence";
  score: number;
}> {
  const matched = [...new Set(review.matchedRequirements.map(normalize))];
  const missing = new Set(review.missingRequirements.map(normalize));
  const evidenced = matched.filter((requirement) => !missing.has(requirement)).length;
  const assessed = new Set([...matched, ...missing]).size;
  const score = assessed ? Math.round((evidenced / assessed) * 100) : 0;
  return {
    assessed,
    evidenced,
    label: score >= 75 ? "Strong evidence" : score >= 50 ? "Moderate evidence" : "Early evidence",
    score,
  };
}

export function reviewHasContactDetails(content: string): boolean {
  return hasContactDetails(content);
}
