import { isPubliclyVisible } from "./publication";

/**
 * Deterministic policy deciding whether a publicly visible job page is
 * indexable. One predicate is shared by page metadata, page rendering,
 * structured-data emission and sitemap inclusion; it never makes a non-public
 * role public.
 *
 * Indexability requires, in addition to the public-visibility conditions in
 * `isPubliclyVisible`:
 *
 *  - an official application URL, and
 *  - sufficient factual page value beyond the title alone, drawn from actual
 *    stored, verified fields (see `hasSufficientFactualValue`).
 *
 * A publicly valid but thin role remains usable (it renders normally) while
 * receiving `noindex, follow` and staying out of the sitemap and structured
 * data. Missing or non-public roles stay `notFound()` with `noindex, nofollow`.
 */
export type JobIndexabilityEvidence = Readonly<{
  active: boolean;
  application_deadline: Date | null;
  application_url: string | null;
  degree_requirements: readonly string[];
  description_summary: string | null;
  eligibility_status: string;
  employment_type: string | null;
  experience_requirements: string | null;
  first_seen_at: Date;
  location_text: string | null;
  opportunity_type: string;
  posted_at: Date | null;
  preferred_skills: readonly string[];
  publication_status: string;
  remote_type: string | null;
  requirements: readonly string[];
  salary_max: number | null;
  salary_min: number | null;
  responsibilities: readonly string[];
  sector_key: string | null;
  skills: readonly string[];
  subsector_key: string | null;
  visa_sponsorship_status: string;
}>;

/** Stored, verified content that adds page value beyond a title alone. */
export function hasSufficientFactualValue(job: JobIndexabilityEvidence): boolean {
  if (nonEmpty(job.description_summary)) return true;
  if (job.responsibilities.length > 0) return true;
  if (job.requirements.length > 0) return true;
  if (job.skills.length > 0) return true;
  if (job.preferred_skills.length > 0) return true;
  if (job.degree_requirements.length > 0) return true;
  if (nonEmpty(job.experience_requirements)) return true;
  if (nonEmpty(job.location_text)) return true;
  if (knownValue(job.employment_type)) return true;
  if (knownValue(job.remote_type)) return true;
  if (job.opportunity_type !== "unknown") return true;
  if (job.sector_key !== null) return true;
  if (job.subsector_key !== null) return true;
  if (knownValue(job.visa_sponsorship_status)) return true;
  if (job.salary_min !== null || job.salary_max !== null) return true;
  if (job.application_deadline !== null) return true;
  if (job.posted_at !== null) return true;
  return false;
}

/** Content capable of supporting a visible, substantive JobPosting description. */
export function hasSubstantiveJobDescription(job: JobIndexabilityEvidence): boolean {
  return (
    nonEmpty(job.description_summary) ||
    job.responsibilities.length > 0 ||
    job.requirements.length > 0 ||
    nonEmpty(job.experience_requirements)
  );
}

export function isJobIndexable(job: JobIndexabilityEvidence, now: Date): boolean {
  if (!isPubliclyVisible(job, now)) return false;
  if (!nonEmpty(job.application_url)) return false;
  if (job.posted_at === null) return false;
  return hasSufficientFactualValue(job) && hasSubstantiveJobDescription(job);
}

function nonEmpty(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

/** A stored field is meaningful page value when present and not a "not specified" placeholder. */
function knownValue(value: string | null | undefined): boolean {
  return nonEmpty(value) && value !== "unknown";
}
