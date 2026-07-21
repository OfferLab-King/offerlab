import { recruitmentStages, type RecruitmentStage } from "../../applications/domain/application";
import { opportunityTypes, type OpportunityType } from "../../taxonomy/domain/opportunity-types";

export const APPLICATION_RECOMMENDATION_LIMIT = 5;
export const DASHBOARD_RECOMMENDATION_LIMIT = 10;

export type RecommendationDeadlineWindow = Readonly<{
  maximumDays: number;
  minimumDays: number;
}>;

export type RecommendationApplicability = Readonly<{
  active: boolean;
  deadlineWindow?: RecommendationDeadlineWindow;
  opportunityTypes?: readonly OpportunityType[];
}>;

export type RecommendationAccessibilityLabels = Readonly<{
  complete: string;
  dismiss: string;
  restore: string;
}>;

export type RecommendationDefinition = Readonly<{
  accessibilityLabels: RecommendationAccessibilityLabels;
  active: boolean;
  applicability: readonly RecommendationApplicability[];
  explanationTemplate: string;
  guidance: string;
  key: string;
  priority: number;
  ruleVersion: number;
  stages: readonly RecruitmentStage[];
  title: string;
  urgencyEligible: boolean;
}>;

const deadlineWindows = [
  { maximumDays: 3, minimumDays: 0 },
  { maximumDays: 7, minimumDays: 4 },
] as const;

function matchingVariants(
  urgencyEligible: boolean,
  opportunityTypes?: readonly OpportunityType[],
): readonly RecommendationApplicability[] {
  const variants: RecommendationApplicability[] = [];

  if (urgencyEligible) {
    for (const deadlineWindow of deadlineWindows) {
      if (opportunityTypes) {
        variants.push({ active: true, deadlineWindow, opportunityTypes });
      }
      variants.push({ active: true, deadlineWindow });
    }
  }

  if (opportunityTypes) variants.push({ active: true, opportunityTypes });
  variants.push({ active: true });
  return variants;
}

function defineRecommendation(
  definition: Omit<RecommendationDefinition, "accessibilityLabels" | "active" | "applicability"> &
    Readonly<{ opportunityTypes?: readonly OpportunityType[] }>,
): RecommendationDefinition {
  const { opportunityTypes, ...content } = definition;
  return {
    ...content,
    accessibilityLabels: {
      complete: `Mark “${definition.title}” as completed.`,
      dismiss: `Dismiss “${definition.title}” recommendation.`,
      restore: `Restore “${definition.title}” to pending.`,
    },
    active: true,
    applicability: matchingVariants(definition.urgencyEligible, opportunityTypes),
  };
}

const structuredEarlyCareerOpportunities = [
  "graduate_scheme",
  "internship",
  "placement",
] as const satisfies readonly OpportunityType[];

/**
 * Current code-owned recommendation catalogue.
 *
 * A key is stable across copy-only changes. Increment ruleVersion only when a
 * material rule change should create a new member-state identity. Only the
 * current version of a stable key belongs in this catalogue; historical state
 * remains in persistence rather than keeping old definitions active here.
 */
export const recommendationCatalogue = [
  defineRecommendation({
    explanationTemplate: "Recommended because this application is currently being prepared.",
    guidance: "Break the remaining work into dated steps and reserve time for a final review.",
    key: "preparing_confirm_deadline_plan",
    priority: 300,
    ruleVersion: 1,
    stages: ["preparing"],
    title: "Confirm the deadline and make a plan",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is currently being prepared.",
    guidance: "Match the strongest evidence in your materials to the role requirements.",
    key: "preparing_tailor_materials",
    opportunityTypes: structuredEarlyCareerOpportunities,
    priority: 200,
    ruleVersion: 1,
    stages: ["preparing"],
    title: "Tailor your application materials",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is currently being prepared.",
    guidance:
      "Note the role requirements, the employer's work and points that support your motivation.",
    key: "preparing_research_role_employer",
    priority: 100,
    ruleVersion: 1,
    stages: ["preparing"],
    title: "Research the role and employer",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application has been submitted.",
    guidance: "Save the exact application, CV and supporting materials that you submitted.",
    key: "applied_preserve_submission",
    priority: 300,
    ruleVersion: 1,
    stages: ["applied"],
    title: "Preserve your submitted materials",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application has been submitted.",
    guidance: "Review the likely assessment and interview steps, then choose one preparation task.",
    key: "applied_prepare_next_stages",
    opportunityTypes: structuredEarlyCareerOpportunities,
    priority: 200,
    ruleVersion: 1,
    stages: ["applied"],
    title: "Prepare for likely next stages",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application has been submitted.",
    guidance: "Record any stated response timing and decide when you will check for an update.",
    key: "applied_check_response_timing",
    priority: 100,
    ruleVersion: 1,
    stages: ["applied"],
    title: "Check the expected response timing",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the online assessment stage.",
    guidance: "Verify the submission date, access instructions and any stated time limit.",
    key: "online_assessment_confirm_deadline",
    priority: 300,
    ruleVersion: 1,
    stages: ["online_assessment"],
    title: "Confirm the assessment deadline",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the online assessment stage.",
    guidance: "Complete a short timed practice in the format you expect to face.",
    key: "online_assessment_practise_format",
    opportunityTypes: structuredEarlyCareerOpportunities,
    priority: 200,
    ruleVersion: 1,
    stages: ["online_assessment"],
    title: "Practise the assessment format",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the online assessment stage.",
    guidance: "Choose a quiet space and check your device, browser, connection and power.",
    key: "online_assessment_check_test_environment",
    priority: 100,
    ruleVersion: 1,
    stages: ["online_assessment"],
    title: "Prepare a reliable test environment",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the video interview stage.",
    guidance: "Choose concise examples that show your motivation, teamwork and problem solving.",
    key: "video_interview_prepare_examples",
    priority: 300,
    ruleVersion: 1,
    stages: ["video_interview"],
    title: "Prepare structured examples",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the video interview stage.",
    guidance: "Record two timed answers, review them once and improve one specific point.",
    key: "video_interview_practise_recorded_answers",
    opportunityTypes: structuredEarlyCareerOpportunities,
    priority: 200,
    ruleVersion: 1,
    stages: ["video_interview"],
    title: "Practise recorded answers",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the video interview stage.",
    guidance: "Check your camera, microphone, lighting, background and internet connection.",
    key: "video_interview_check_recording_environment",
    priority: 100,
    ruleVersion: 1,
    stages: ["video_interview"],
    title: "Check your recording environment",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the interview stage.",
    guidance: "Prepare evidence-based examples for the main skills the role requires.",
    key: "interview_prepare_evidence_examples",
    priority: 300,
    ruleVersion: 1,
    stages: ["interview"],
    title: "Prepare evidence-based examples",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the interview stage.",
    guidance: "Review the role, the employer and a small number of relevant recent developments.",
    key: "interview_research_context",
    opportunityTypes: ["graduate_scheme"],
    priority: 200,
    ruleVersion: 1,
    stages: ["interview"],
    title: "Refresh your role and employer research",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the interview stage.",
    guidance: "Confirm who you will meet, how the interview will run and what you need to bring.",
    key: "interview_confirm_format_logistics",
    priority: 100,
    ruleVersion: 1,
    stages: ["interview"],
    title: "Confirm the format and logistics",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the assessment centre stage.",
    guidance: "Practise contributing clearly in both group and individual exercises.",
    key: "assessment_centre_prepare_exercises",
    opportunityTypes: structuredEarlyCareerOpportunities,
    priority: 300,
    ruleVersion: 1,
    stages: ["assessment_centre"],
    title: "Prepare for the exercises",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the assessment centre stage.",
    guidance:
      "Review the organisation, its market and the commercial context relevant to the role.",
    key: "assessment_centre_review_context",
    priority: 200,
    ruleVersion: 1,
    stages: ["assessment_centre"],
    title: "Review the organisational context",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the assessment centre stage.",
    guidance: "Check the timetable, location or joining details, travel and required materials.",
    key: "assessment_centre_confirm_schedule",
    priority: 100,
    ruleVersion: 1,
    stages: ["assessment_centre"],
    title: "Confirm the schedule and logistics",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the offer stage.",
    guidance:
      "Read the written terms carefully and record the date by which a response is requested.",
    key: "offer_review_terms_deadline",
    priority: 300,
    ruleVersion: 1,
    stages: ["offer"],
    title: "Review the terms and response deadline",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the offer stage.",
    guidance: "List factual questions or conditions that need clarification before you respond.",
    key: "offer_identify_questions",
    priority: 200,
    ruleVersion: 1,
    stages: ["offer"],
    title: "Identify questions to clarify",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the offer stage.",
    guidance:
      "Compare the role against your priorities and seek qualified advice where you need it.",
    key: "offer_compare_priorities",
    opportunityTypes: ["graduate_scheme", "placement"],
    priority: 100,
    ruleVersion: 1,
    stages: ["offer"],
    title: "Compare the offer with your priorities",
    urgencyEligible: true,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the rejected stage.",
    guidance:
      "Save any feedback you received and separate specific evidence from general comments.",
    key: "rejected_capture_feedback",
    priority: 300,
    ruleVersion: 1,
    stages: ["rejected"],
    title: "Capture useful feedback",
    urgencyEligible: false,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the rejected stage.",
    guidance: "Choose one realistic change to make before your next similar application.",
    key: "rejected_choose_improvement",
    priority: 200,
    ruleVersion: 1,
    stages: ["rejected"],
    title: "Choose one concrete improvement",
    urgencyEligible: false,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the rejected stage.",
    guidance: "Decide whether the record is still useful to keep active or is ready to archive.",
    key: "rejected_review_archive_choice",
    priority: 100,
    ruleVersion: 1,
    stages: ["rejected"],
    title: "Review whether to archive the application",
    urgencyEligible: false,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the withdrawn stage.",
    guidance: "If it would help later, add a short private note explaining why you withdrew.",
    key: "withdrawn_record_reason",
    priority: 300,
    ruleVersion: 1,
    stages: ["withdrawn"],
    title: "Record the reason if useful",
    urgencyEligible: false,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the withdrawn stage.",
    guidance: "Decide whether the record is still useful to keep active or is ready to archive.",
    key: "withdrawn_review_archive_choice",
    priority: 200,
    ruleVersion: 1,
    stages: ["withdrawn"],
    title: "Review whether to archive the application",
    urgencyEligible: false,
  }),
  defineRecommendation({
    explanationTemplate: "Recommended because this application is at the withdrawn stage.",
    guidance: "Keep reusable examples, research and preparation notes for future applications.",
    key: "withdrawn_retain_materials",
    priority: 100,
    ruleVersion: 1,
    stages: ["withdrawn"],
    title: "Retain reusable preparation material",
    urgencyEligible: false,
  }),
] as const satisfies readonly RecommendationDefinition[];

const recommendationKeyPattern = /^[a-z][a-z0-9_]{0,79}$/;
const approvedStages = new Set<string>(Object.keys(recruitmentStages));
const approvedOpportunityTypes = new Set<string>(Object.keys(opportunityTypes));
const prohibitedCatalogueToken =
  /\$\{[^}]*\}|\{\{[^}]*\}\}|%\{[^}]*\}|<(?:company|role|location|industry|notes|onboarding|confidence|support[_ -]?needs|member|owner|application[_ -]?id|recommendation[_ -]?state[_ -]?id)>|:(?:company|role|location|industry|notes|onboarding|confidence|support[_ -]?needs|member|owner|application[_ -]?id|recommendation[_ -]?state[_ -]?id)\b/i;

/**
 * Catalogue copy is static. There are currently no approved placeholders:
 * urgency explanations are composed by the engine from controlled date facts.
 */
export function assertRecommendationCataloguePrivacy(
  catalogue: readonly RecommendationDefinition[],
): void {
  for (const definition of catalogue) {
    const fields: Readonly<Record<string, unknown>> = {
      "accessibility complete": definition.accessibilityLabels.complete,
      "accessibility dismiss": definition.accessibilityLabels.dismiss,
      "accessibility restore": definition.accessibilityLabels.restore,
      "action guidance": definition.guidance,
      "explanation template": definition.explanationTemplate,
      title: definition.title,
    };
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value !== "string" || prohibitedCatalogueToken.test(value)) {
        throw new Error(`Unsafe catalogue ${field} for recommendation: ${definition.key}`);
      }
    }
  }
}

export function assertValidRecommendationCatalogue(
  catalogue: readonly RecommendationDefinition[],
): void {
  const keys = new Set<string>();

  for (const definition of catalogue) {
    if (!recommendationKeyPattern.test(definition.key)) {
      throw new Error(`Invalid recommendation key: ${definition.key}`);
    }
    if (keys.has(definition.key)) {
      throw new Error(`Duplicate current recommendation key: ${definition.key}`);
    }
    keys.add(definition.key);

    if (!Number.isSafeInteger(definition.ruleVersion) || definition.ruleVersion <= 0) {
      throw new Error(`Invalid rule version for recommendation: ${definition.key}`);
    }
    if (!Number.isSafeInteger(definition.priority)) {
      throw new Error(`Invalid priority for recommendation: ${definition.key}`);
    }
    if (
      definition.stages.length === 0 ||
      new Set(definition.stages).size !== definition.stages.length
    ) {
      throw new Error(`Invalid stage coverage for recommendation: ${definition.key}`);
    }
    if (definition.stages.some((stage) => !approvedStages.has(stage))) {
      throw new Error(`Unsupported stage for recommendation: ${definition.key}`);
    }
    if (definition.applicability.length === 0) {
      throw new Error(`Missing applicability for recommendation: ${definition.key}`);
    }
    if (
      !definition.title.trim() ||
      !definition.guidance.trim() ||
      !definition.explanationTemplate.trim() ||
      !definition.accessibilityLabels.complete.trim() ||
      !definition.accessibilityLabels.dismiss.trim() ||
      !definition.accessibilityLabels.restore.trim()
    ) {
      throw new Error(`Missing catalogue content for recommendation: ${definition.key}`);
    }

    const variants = new Set<string>();
    for (const applicability of definition.applicability) {
      const opportunities = applicability.opportunityTypes;
      if (
        opportunities &&
        (opportunities.length === 0 || new Set(opportunities).size !== opportunities.length)
      ) {
        throw new Error(`Invalid opportunity applicability for recommendation: ${definition.key}`);
      }
      if (opportunities?.some((opportunity) => !approvedOpportunityTypes.has(opportunity))) {
        throw new Error(
          `Unsupported opportunity applicability for recommendation: ${definition.key}`,
        );
      }
      const window = applicability.deadlineWindow;
      if (
        window &&
        (!Number.isSafeInteger(window.minimumDays) ||
          !Number.isSafeInteger(window.maximumDays) ||
          window.minimumDays < 0 ||
          window.maximumDays < window.minimumDays)
      ) {
        throw new Error(`Invalid deadline window for recommendation: ${definition.key}`);
      }
      const signature = JSON.stringify({
        deadlineWindow: window ?? null,
        opportunityTypes: opportunities ? [...opportunities].sort() : null,
      });
      if (variants.has(signature)) {
        throw new Error(`Duplicate applicability for recommendation: ${definition.key}`);
      }
      variants.add(signature);
    }
  }
  assertRecommendationCataloguePrivacy(catalogue);
}

export function assertRecommendationStageCoverage(
  catalogue: readonly RecommendationDefinition[],
): void {
  for (const stage of Object.keys(recruitmentStages) as RecruitmentStage[]) {
    if (
      !catalogue.some(
        (definition) =>
          definition.active &&
          definition.stages.includes(stage) &&
          definition.applicability.some((applicability) => applicability.active),
      )
    ) {
      throw new Error(`Missing active recommendation coverage for stage: ${stage}`);
    }
  }
}

assertValidRecommendationCatalogue(recommendationCatalogue);
assertRecommendationStageCoverage(recommendationCatalogue);
