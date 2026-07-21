import { recruitmentStages, type RecruitmentStage } from "../../applications/domain/application";
import { opportunityTypes, type OpportunityType } from "../../taxonomy/domain/opportunity-types";
import {
  APPLICATION_RECOMMENDATION_LIMIT,
  assertValidRecommendationCatalogue,
  DASHBOARD_RECOMMENDATION_LIMIT,
  recommendationCatalogue,
  type RecommendationAccessibilityLabels,
  type RecommendationApplicability,
  type RecommendationDefinition,
} from "./catalogue";

export type RecommendationUrgency = "urgent" | "high" | "normal";

export type RecommendationIdentity = Readonly<{
  applicationId: string;
  key: string;
  ruleVersion: number;
}>;

export type EvaluatedRecommendation = Readonly<{
  accessibilityLabels: RecommendationAccessibilityLabels;
  explanation: string;
  guidance: string;
  identity: RecommendationIdentity;
  title: string;
  urgency: RecommendationUrgency;
  resourceSlug: string;
}>;

export type RecommendationApplication = Readonly<{
  appliedDate: string | null;
  applicationDeadline: string | null;
  archivedAt: Date | null;
  id: string;
  nextStageDeadline: string | null;
  opportunityType: OpportunityType;
  stage: RecruitmentStage;
}>;

export type RecommendationClock = Readonly<{
  now: () => Date;
}>;

export type RecommendationEvaluationOptions = Readonly<{
  catalogue?: readonly RecommendationDefinition[];
  clock?: RecommendationClock;
  include?: (recommendation: EvaluatedRecommendation) => boolean;
  limit?: number;
}>;

export const systemRecommendationClock: RecommendationClock = Object.freeze({
  now: () => new Date(),
});

type DeadlineKind = "application" | "next_stage";

type AssessedDeadline = Readonly<{
  calendarDay: number;
  date: string;
  daysUntil: number;
  kind: DeadlineKind;
}>;

type DeadlineContext = Readonly<{
  urgencyDeadline: AssessedDeadline | null;
  windowDeadline: AssessedDeadline | null;
}>;

type RecommendationSpecificity =
  "stage_deadline_opportunity" | "stage_deadline" | "stage_opportunity" | "stage";

type Candidate = Readonly<{
  definition: RecommendationDefinition;
  deadlineContext: DeadlineContext;
  recommendation: EvaluatedRecommendation;
  sortDeadline: number | null;
  specificity: RecommendationSpecificity;
}>;

const millisecondsPerDay = 86_400_000;
const londonDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/London",
  year: "numeric",
});
const approvedStages = new Set<string>(Object.keys(recruitmentStages));
const approvedOpportunityTypes = new Set<string>(Object.keys(opportunityTypes));
const terminalStages = new Set<RecruitmentStage>(["rejected", "withdrawn"]);

const specificityRank: Readonly<Record<RecommendationSpecificity, number>> = {
  stage_deadline_opportunity: 4,
  stage_deadline: 3,
  stage_opportunity: 2,
  stage: 1,
};

const urgencyRank: Readonly<Record<RecommendationUrgency, number>> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function calendarDay(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid recommendation date input.");
  const [year, month, day] = date.split("-").map(Number);
  const instant = Date.UTC(year!, month! - 1, day);
  const parsed = new Date(instant);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month! - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid recommendation date input.");
  }
  return instant / millisecondsPerDay;
}

export function londonCalendarDate(instant: Date): string {
  if (!Number.isFinite(instant.getTime())) throw new Error("Invalid recommendation clock instant.");
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of londonDateFormatter.formatToParts(instant)) values[part.type] = part.value;
  const year = values.year;
  const month = values.month;
  const day = values.day;
  if (!year || !month || !day) throw new Error("Could not resolve the London calendar date.");
  return `${year}-${month}-${day}`;
}

function assessDeadline(
  date: string | null,
  kind: DeadlineKind,
  todayCalendarDay: number,
): AssessedDeadline | null {
  if (date === null) return null;
  const assessedCalendarDay = calendarDay(date);
  return {
    calendarDay: assessedCalendarDay,
    date,
    daysUntil: assessedCalendarDay - todayCalendarDay,
    kind,
  };
}

/**
 * ADR 0008 selection: today/future next-stage deadlines win. A past
 * next-stage deadline remains the overdue urgency signal, but cannot satisfy a
 * future deadline window; a today/future application deadline may satisfy that
 * window instead. Without a future/today deadline, only unwindowed variants
 * match. Terminal outcomes do not receive deadline urgency.
 */
function selectDeadlineContext(
  application: RecommendationApplication,
  todayCalendarDay: number,
): DeadlineContext {
  if (terminalStages.has(application.stage)) {
    return { urgencyDeadline: null, windowDeadline: null };
  }

  const nextStage = assessDeadline(application.nextStageDeadline, "next_stage", todayCalendarDay);
  const applicationDeadline = assessDeadline(
    application.applicationDeadline,
    "application",
    todayCalendarDay,
  );

  if (nextStage && nextStage.daysUntil >= 0) {
    return { urgencyDeadline: nextStage, windowDeadline: nextStage };
  }
  if (nextStage) {
    return {
      urgencyDeadline: nextStage,
      windowDeadline:
        applicationDeadline && applicationDeadline.daysUntil >= 0 ? applicationDeadline : null,
    };
  }
  return {
    urgencyDeadline: applicationDeadline,
    windowDeadline:
      applicationDeadline && applicationDeadline.daysUntil >= 0 ? applicationDeadline : null,
  };
}

function urgencyFor(
  urgencyEligible: boolean,
  deadline: AssessedDeadline | null,
): RecommendationUrgency {
  if (!urgencyEligible || !deadline) return "normal";
  if (deadline.daysUntil <= 3) return "urgent";
  if (deadline.daysUntil <= 7) return "high";
  return "normal";
}

function explanationFor(
  definition: RecommendationDefinition,
  deadline: AssessedDeadline | null,
  urgency: RecommendationUrgency,
): string {
  if (!deadline || urgency === "normal") return definition.explanationTemplate;
  const deadlineName =
    deadline.kind === "next_stage" ? "next-stage deadline" : "application deadline";
  const urgencyExplanation =
    deadline.daysUntil < 0
      ? `Prioritised because the ${deadlineName} has passed.`
      : deadline.daysUntil === 0
        ? `Prioritised because the ${deadlineName} is today.`
        : urgency === "urgent"
          ? `Prioritised because the ${deadlineName} is within three calendar days.`
          : `Prioritised because the ${deadlineName} is within seven calendar days.`;
  return `${urgencyExplanation} ${definition.explanationTemplate}`;
}

function specificityOf(applicability: RecommendationApplicability): RecommendationSpecificity {
  const deadline = applicability.deadlineWindow !== undefined;
  const opportunity = applicability.opportunityTypes !== undefined;
  if (deadline && opportunity) return "stage_deadline_opportunity";
  if (deadline) return "stage_deadline";
  if (opportunity) return "stage_opportunity";
  return "stage";
}

function matchesApplicability(
  applicability: RecommendationApplicability,
  application: RecommendationApplication,
  windowDeadline: AssessedDeadline | null,
): boolean {
  if (!applicability.active) return false;
  if (
    applicability.opportunityTypes &&
    !applicability.opportunityTypes.includes(application.opportunityType)
  ) {
    return false;
  }
  if (applicability.deadlineWindow) {
    if (!windowDeadline) return false;
    if (
      windowDeadline.daysUntil < applicability.deadlineWindow.minimumDays ||
      windowDeadline.daysUntil > applicability.deadlineWindow.maximumDays
    ) {
      return false;
    }
  }
  return true;
}

function bestSpecificity(
  definition: RecommendationDefinition,
  application: RecommendationApplication,
  windowDeadline: AssessedDeadline | null,
): RecommendationSpecificity | null {
  let best: RecommendationSpecificity | null = null;
  for (const applicability of definition.applicability) {
    if (!matchesApplicability(applicability, application, windowDeadline)) continue;
    const specificity = specificityOf(applicability);
    if (!best || specificityRank[specificity] > specificityRank[best]) best = specificity;
  }
  return best;
}

function assertApplication(application: RecommendationApplication): void {
  if (!approvedStages.has(application.stage)) throw new Error("Unsupported recommendation stage.");
  if (!approvedOpportunityTypes.has(application.opportunityType)) {
    throw new Error("Unsupported recommendation opportunity type.");
  }
  if (!application.id) throw new Error("Missing recommendation application identifier.");
  for (const date of [
    application.appliedDate,
    application.applicationDeadline,
    application.nextStageDeadline,
  ]) {
    if (date !== null) calendarDay(date);
  }
  if (application.archivedAt !== null && !Number.isFinite(application.archivedAt.getTime())) {
    throw new Error("Invalid recommendation archive timestamp.");
  }
}

function boundedLimit(requested: number | undefined, maximum: number): number {
  if (requested === undefined) return maximum;
  if (!Number.isSafeInteger(requested) || requested < 0) {
    throw new Error("Invalid recommendation result limit.");
  }
  return Math.min(requested, maximum);
}

function evaluationDate(clock: RecommendationClock): number {
  const now = clock.now();
  if (!(now instanceof Date)) throw new Error("Invalid recommendation clock instant.");
  return calendarDay(londonCalendarDate(now));
}

function candidateFor(
  application: RecommendationApplication,
  definition: RecommendationDefinition,
  deadlineContext: DeadlineContext,
): Candidate | null {
  if (!definition.active || !definition.stages.includes(application.stage)) return null;
  const specificity = bestSpecificity(definition, application, deadlineContext.windowDeadline);
  if (!specificity) return null;
  const urgency = urgencyFor(definition.urgencyEligible, deadlineContext.urgencyDeadline);
  return {
    definition,
    deadlineContext,
    recommendation: {
      accessibilityLabels: definition.accessibilityLabels,
      explanation: explanationFor(definition, deadlineContext.urgencyDeadline, urgency),
      guidance: definition.guidance,
      identity: {
        applicationId: application.id,
        key: definition.key,
        ruleVersion: definition.ruleVersion,
      },
      title: definition.title,
      urgency,
      resourceSlug: definition.resourceSlug ?? "application-planning-checklist",
    },
    // ADR 0008: ordering follows the eligible recommendation-window deadline.
    // The urgency deadline is deliberately separate and may be an overdue
    // next-stage deadline when a future application deadline is the fallback.
    sortDeadline: deadlineContext.windowDeadline?.calendarDay ?? null,
    specificity,
  };
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const specificity = specificityRank[right.specificity] - specificityRank[left.specificity];
  if (specificity !== 0) return specificity;

  const priority = right.definition.priority - left.definition.priority;
  if (priority !== 0) return priority;

  const urgency =
    urgencyRank[left.recommendation.urgency] - urgencyRank[right.recommendation.urgency];
  if (urgency !== 0) return urgency;

  if (left.sortDeadline !== right.sortDeadline) {
    if (left.sortDeadline === null) return 1;
    if (right.sortDeadline === null) return -1;
    return left.sortDeadline - right.sortDeadline;
  }

  const key = compareText(left.definition.key, right.definition.key);
  if (key !== 0) return key;
  return compareText(
    left.recommendation.identity.applicationId,
    right.recommendation.identity.applicationId,
  );
}

function evaluateCandidates(
  application: RecommendationApplication,
  catalogue: readonly RecommendationDefinition[],
  todayCalendarDay: number,
): readonly Candidate[] {
  assertApplication(application);
  if (application.archivedAt) return [];
  const deadlineContext = selectDeadlineContext(application, todayCalendarDay);
  const candidates = catalogue
    .map((definition) => candidateFor(application, definition, deadlineContext))
    .filter((candidate): candidate is Candidate => candidate !== null);
  return candidates.sort(compareCandidates);
}

export function findRecommendationDefinition(
  key: string,
  ruleVersion: number,
  catalogue: readonly RecommendationDefinition[] = recommendationCatalogue,
): RecommendationDefinition | null {
  return (
    catalogue.find(
      (definition) => definition.key === key && definition.ruleVersion === ruleVersion,
    ) ?? null
  );
}

export function evaluateApplicationRecommendations(
  application: RecommendationApplication,
  options: RecommendationEvaluationOptions = {},
): readonly EvaluatedRecommendation[] {
  const catalogue = options.catalogue ?? recommendationCatalogue;
  assertValidRecommendationCatalogue(catalogue);
  const todayCalendarDay = evaluationDate(options.clock ?? systemRecommendationClock);
  return evaluateCandidates(application, catalogue, todayCalendarDay)
    .filter((candidate) => options.include?.(candidate.recommendation) ?? true)
    .slice(0, boundedLimit(options.limit, APPLICATION_RECOMMENDATION_LIMIT))
    .map((candidate) => candidate.recommendation);
}

export function evaluateAllApplicationRecommendations(
  application: RecommendationApplication,
  options: Omit<RecommendationEvaluationOptions, "include" | "limit"> = {},
): readonly EvaluatedRecommendation[] {
  const catalogue = options.catalogue ?? recommendationCatalogue;
  assertValidRecommendationCatalogue(catalogue);
  const todayCalendarDay = evaluationDate(options.clock ?? systemRecommendationClock);
  return evaluateCandidates(application, catalogue, todayCalendarDay).map(
    (candidate) => candidate.recommendation,
  );
}

export function evaluateDashboardRecommendations(
  applications: readonly RecommendationApplication[],
  options: RecommendationEvaluationOptions = {},
): readonly EvaluatedRecommendation[] {
  const catalogue = options.catalogue ?? recommendationCatalogue;
  assertValidRecommendationCatalogue(catalogue);
  const todayCalendarDay = evaluationDate(options.clock ?? systemRecommendationClock);
  const candidates = applications.flatMap((application) =>
    evaluateCandidates(application, catalogue, todayCalendarDay)
      .filter((candidate) => options.include?.(candidate.recommendation) ?? true)
      .slice(0, APPLICATION_RECOMMENDATION_LIMIT),
  );
  const uniqueCandidates = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const { applicationId, key, ruleVersion } = candidate.recommendation.identity;
    const identity = `${applicationId}\u0000${key}\u0000${ruleVersion}`;
    if (!uniqueCandidates.has(identity)) uniqueCandidates.set(identity, candidate);
  }
  return [...uniqueCandidates.values()]
    .sort(compareCandidates)
    .slice(0, boundedLimit(options.limit, DASHBOARD_RECOMMENDATION_LIMIT))
    .map((candidate) => candidate.recommendation);
}

export function resolveApplicationRecommendation(
  application: RecommendationApplication,
  key: string,
  ruleVersion: number,
  options: Omit<RecommendationEvaluationOptions, "include" | "limit"> = {},
): EvaluatedRecommendation | null {
  const catalogue = options.catalogue ?? recommendationCatalogue;
  assertValidRecommendationCatalogue(catalogue);
  const definition = findRecommendationDefinition(key, ruleVersion, catalogue);
  if (!definition) return null;
  assertApplication(application);
  if (application.archivedAt) return null;
  const todayCalendarDay = evaluationDate(options.clock ?? systemRecommendationClock);
  const deadlineContext = selectDeadlineContext(application, todayCalendarDay);
  return candidateFor(application, definition, deadlineContext)?.recommendation ?? null;
}
