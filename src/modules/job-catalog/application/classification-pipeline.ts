import { classifyJob, classificationRequiresReview } from "../domain/classification";
import type { DiscoveredJob } from "../domain/deduplication";
import { evaluateEligibility } from "../domain/eligibility";
import type { JobClassificationWrite } from "../infrastructure/job-repository";

/**
 * Deterministic eligibility + classification pipeline applied to every
 * discovered or changed job. AI never runs here and this pipeline never writes
 * rows whose classification_source is 'administrator' (guarded in
 * applyCrawlPlan). Publication decision:
 *  - eligible          -> published
 *  - needs_review      -> draft (administrator queue)
 *  - ineligible        -> suppressed
 *
 * Career level is classification information, not a publication gate: valid
 * general and experienced-hire roles are eligible alongside early-career roles.
 */
export function classifyDiscoveredJob(discovered: DiscoveredJob): JobClassificationWrite {
  const eligibility = evaluateEligibility({
    applicationDeadline: discovered.applicationDeadline,
    description: discovered.descriptionText,
    title: discovered.title,
  });
  const classification = classifyJob({
    department: sourcePayloadString(discovered, "department"),
    team: sourcePayloadString(discovered, "team"),
    title: discovered.title,
  });

  const publicationStatus =
    eligibility.status === "eligible"
      ? "published"
      : eligibility.status === "ineligible"
        ? "suppressed"
        : "draft";

  return {
    classificationSource: "deterministic",
    eligibilityEvidence: eligibility.evidence[0] ?? null,
    eligibilityReasons: eligibility.reasons,
    eligibilityStatus: eligibility.status,
    opportunityType: eligibility.opportunityType,
    publicationStatus,
    sectorKey: classificationRequiresReview(classification) ? null : classification.sectorKey,
    subsectorKey: classificationRequiresReview(classification) ? null : classification.subsectorKey,
  };
}

function sourcePayloadString(discovered: DiscoveredJob, key: string): string | null {
  if (typeof discovered.sourcePayload !== "object" || discovered.sourcePayload === null)
    return null;
  const value = (discovered.sourcePayload as Readonly<Record<string, unknown>>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
