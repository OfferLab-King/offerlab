import {
  employmentTypeLabels,
  opportunityTypeLabels,
} from "../../../modules/job-catalog/domain/taxonomy";

type JobContent = Readonly<{
  company_name: string;
  degree_requirements: readonly string[];
  description_summary: string | null;
  employment_type: string | null;
  experience_requirements: string | null;
  location_text: string | null;
  normalized_title: string | null;
  opportunity_type: string;
  preferred_skills: readonly string[];
  requirements: readonly string[];
  responsibilities: readonly string[];
  skills: readonly string[];
  title: string;
}>;

/** Search-snippet budget for the meta description. */
export const META_DESCRIPTION_LIMIT = 158;
export const PAGE_TITLE_LIMIT = 70;

export function roleTitle(job: Pick<JobContent, "normalized_title" | "title">): string {
  return job.normalized_title ?? job.title;
}

/**
 * Concise unique page title: role, employer, and location context when the
 * stored source provides it. No keyword stuffing; the opportunity/employment
 * type stays in the body facts and description.
 */
export function jobPageTitle(job: JobContent): string {
  const role = roleTitle(job);
  const location = job.location_text?.trim() ? ` in ${job.location_text.trim()}` : "";
  const suffix = " | OfferLab";
  const core = `${role} at ${job.company_name}${location}`;
  return `${truncate(core, PAGE_TITLE_LIMIT - suffix.length)}${suffix}`;
}

/**
 * Factual meta description built from verified stored content, capped at a
 * sensible snippet length. Falls back to a short factual sentence of the role,
 * employer and location rather than any invented claims.
 */
export function jobMetaDescription(job: JobContent): string {
  const summary = job.description_summary?.trim();
  const role = roleTitle(job);
  if (summary) {
    return truncate(`${role} at ${job.company_name}: ${summary}`, META_DESCRIPTION_LIMIT);
  }
  const location = job.location_text?.trim();
  const typeLabel =
    job.opportunity_type && job.opportunity_type !== "unknown"
      ? (opportunityTypeLabels[job.opportunity_type as keyof typeof opportunityTypeLabels] ?? null)
      : null;
  const employmentLabel =
    job.employment_type && job.employment_type !== "unknown"
      ? (employmentTypeLabels[job.employment_type as keyof typeof employmentTypeLabels] ?? null)
      : null;
  const context = [location, typeLabel, employmentLabel].filter(Boolean).join(", ");
  const sentence = `${role} at ${job.company_name}${context ? ` (${context})` : ""}. Application is completed on the employer's official website.`;
  return truncate(sentence, META_DESCRIPTION_LIMIT);
}

/**
 * Meaningful factual description for structured data, drawn from stored
 * verified content. Never falls back to the title alone.
 */
export function jobFactualDescription(job: JobContent): string | null {
  const summary = job.description_summary?.trim();
  const parts: string[] = [];
  if (summary) parts.push(summary);
  if (job.responsibilities.length > 0) {
    parts.push(`Key responsibilities: ${job.responsibilities.join("; ")}.`);
  }
  if (job.requirements.length > 0) {
    parts.push(`Requirements: ${job.requirements.join("; ")}.`);
  }
  if (job.preferred_skills.length > 0) {
    parts.push(`Preferred requirements: ${job.preferred_skills.join("; ")}.`);
  }
  if (job.skills.length > 0) {
    parts.push(`Skills: ${job.skills.join("; ")}.`);
  }
  if (job.degree_requirements.length > 0) {
    parts.push(`Qualifications: ${job.degree_requirements.join("; ")}.`);
  }
  const experience = job.experience_requirements?.trim();
  if (experience) parts.push(`Experience required: ${experience}.`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}
