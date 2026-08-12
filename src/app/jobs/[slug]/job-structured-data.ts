import { isJobIndexable } from "../../../modules/job-catalog/domain/job-indexability";
import type {
  JobDetailRow,
  JobLocationEvidence,
} from "../../../modules/job-catalog/application/catalog";
import { jobFactualDescription, roleTitle } from "./job-detail-content";

/**
 * Schema.org structured data for an indexable public job page. Emits a
 * JobPosting only when the deterministic indexability policy qualifies the
 * role, followed by a BreadcrumbList matching the visible breadcrumb. Every
 * field is emitted only when verified stored evidence supports it: no empty
 * strings, invented dates, misleading remote claims, title-only descriptions
 * or unverified salary or sponsorship statements.
 */
export function buildJobStructuredData(
  job: JobDetailRow,
  now: Date,
  baseUrl: string,
): readonly Record<string, unknown>[] | null {
  if (!isJobIndexable(job, now)) return null;
  const canonical = new URL(`/jobs/${job.slug}`, baseUrl).toString();
  const description = jobFactualDescription(job);
  if (description === null || job.posted_at === null) return null;
  const remoteWork = remoteWorkEvidence(job);
  return [
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      datePosted: job.posted_at.toISOString(),
      description,
      employmentType: employmentTypeFor(job.employment_type),
      hiringOrganization: hiringOrganization(job),
      identifier: { "@type": "PropertyValue", name: job.company_name, value: job.slug },
      jobLocation: jobLocation(job),
      ...remoteWork,
      title: roleTitle(job),
      url: canonical,
      validThrough: job.application_deadline?.toISOString(),
      ...baseSalary(job),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          name: "Jobs",
          position: 1,
          item: new URL("/jobs", baseUrl).toString(),
        },
        {
          "@type": "ListItem",
          name: roleTitle(job),
          position: 2,
          item: canonical,
        },
      ],
    },
  ];
}

const EMPLOYMENT_TYPE_MAP: Readonly<Record<string, string>> = {
  contract: "CONTRACTOR",
  full_time: "FULL_TIME",
  graduate_programme: "OTHER",
  internship: "INTERN",
  other: "OTHER",
  part_time: "PART_TIME",
};

function employmentTypeFor(value: string | null): string | undefined {
  if (value === null || value === "unknown") return undefined;
  return EMPLOYMENT_TYPE_MAP[value] ?? "OTHER";
}

function hiringOrganization(job: JobDetailRow): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: job.company_name,
    ...((job.company_website_url ?? job.company_careers_url)
      ? { url: job.company_website_url ?? job.company_careers_url }
      : {}),
    ...(job.company_logo_url ? { logo: job.company_logo_url } : {}),
  };
}

/**
 * Structural location evidence: verified structured city/region/country from
 * `app.job_location` when present, otherwise the stored source location text,
 * otherwise a Remote place only when the stored work mode says remote.
 */
function jobLocation(
  job: JobDetailRow,
): readonly Record<string, unknown>[] | Record<string, unknown> | undefined {
  const physicalLocations =
    job.remote_type === "remote"
      ? job.locations.filter((location) => location.on_site || location.hybrid)
      : job.locations;
  const places = structuredPlaces(physicalLocations);
  if (places.length > 0) return places.length === 1 ? places[0] : places;
  return undefined;
}

function structuredPlaces(
  locations: readonly JobLocationEvidence[],
): readonly Record<string, unknown>[] {
  const places: Record<string, unknown>[] = [];
  for (const location of locations) {
    if (!location.country?.trim()) continue;
    const address: Record<string, string> = {};
    if (location.city) address.addressLocality = location.city;
    if (location.region) address.addressRegion = location.region;
    if (location.country) address.addressCountry = location.country;
    if (Object.keys(address).length === 0) continue;
    places.push({ "@type": "Place", address: { "@type": "PostalAddress", ...address } });
  }
  return places;
}

function remoteWorkEvidence(job: JobDetailRow): Record<string, unknown> {
  if (job.remote_type !== "remote") return {};
  const countries = [
    ...new Set(
      job.locations
        .filter((location) => location.remote)
        .map((location) => location.country?.trim())
        .filter((country): country is string => Boolean(country)),
    ),
  ];
  if (countries.length === 0) return {};
  const requirements = countries.map((name) => ({ "@type": "Country", name }));
  return {
    applicantLocationRequirements: requirements.length === 1 ? requirements[0] : requirements,
    jobLocationType: "TELECOMMUTE",
  };
}

const SALARY_PERIOD_UNITS: Readonly<Record<string, string>> = {
  annual: "YEAR",
  annum: "YEAR",
  daily: "DAY",
  day: "DAY",
  hourly: "HOUR",
  hour: "HOUR",
  monthly: "MONTH",
  month: "MONTH",
  week: "WEEK",
  weekly: "WEEK",
  year: "YEAR",
};

/**
 * Verified salary evidence only: an amount (min and/or max), the stored
 * currency and a period that maps to a Schema.org unit. Without all three the
 * salary cannot be represented correctly and is omitted.
 */
function baseSalary(
  job: JobDetailRow,
): Readonly<{ baseSalary: Record<string, unknown> }> | Record<string, never> {
  const currency = job.salary_currency?.trim().toUpperCase();
  const unitText = job.salary_period
    ? SALARY_PERIOD_UNITS[job.salary_period.toLowerCase()]
    : undefined;
  if (job.salary_min === null && job.salary_max === null) return {};
  if (!currency || !/^[A-Z]{3}$/u.test(currency) || !unitText) return {};
  const amount: Record<string, unknown> = { "@type": "QuantitativeValue", unitText };
  if (job.salary_min !== null) amount.minValue = Number(job.salary_min);
  if (job.salary_max !== null) amount.maxValue = Number(job.salary_max);
  return {
    baseSalary: {
      "@type": "MonetaryAmount",
      currency,
      value: amount,
    },
  };
}
