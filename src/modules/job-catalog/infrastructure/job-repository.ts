import type { TransactionSql } from "postgres";
import { jsonParameter } from "./crawler-database";
import {
  contentHashForDiscovered,
  type CrawlChangePlan,
  type ExistingJobRecord,
} from "../domain/change-detection";
import type { DiscoveredJob, DiscoveredLocation } from "../domain/deduplication";
import type { EligibilityReason, EligibilityStatus } from "../domain/eligibility";
import type { OpportunityType } from "../domain/taxonomy";

export type PublicationStatus = "draft" | "published" | "suppressed" | "expired";
export type ClassificationSource = "source" | "deterministic" | "administrator" | "ai_assisted";

export type JobClassificationWrite = Readonly<{
  careerLevelKey: string | null;
  jobFunctionKey: string | null;
  sectorKey: string | null;
  subsectorKey: string | null;
  opportunityType: OpportunityType;
  eligibilityStatus: EligibilityStatus;
  eligibilityReasons: readonly EligibilityReason[];
  eligibilityEvidence: string | null;
  publicationStatus: PublicationStatus;
  classificationSource: ClassificationSource;
}>;

export type ExistingJobRow = Readonly<{
  active: boolean;
  application_url: string;
  classification_source: string;
  content_hash: string;
  external_job_id: string | null;
  id: string;
  last_seen_at: Date;
  location_text: string | null;
  missed_crawls: number;
  publication_status: string;
  slug: string;
  source_url: string | null;
  title: string;
}>;

export function existingRecord(row: ExistingJobRow): ExistingJobRecord {
  return {
    active: row.active,
    applicationUrl: row.application_url,
    contentHash: row.content_hash,
    externalJobId: row.external_job_id,
    id: row.id,
    lastSeenAt: row.last_seen_at,
    locationText: row.location_text,
    missedCrawls: row.missed_crawls,
    sourceUrl: row.source_url,
    title: row.title,
  };
}

export async function listJobsForCompany(
  database: TransactionSql,
  companyId: string,
): Promise<readonly ExistingJobRow[]> {
  return database<ExistingJobRow[]>`
    select id, slug, external_job_id, source_url, application_url, title,
      location_text, active, content_hash, missed_crawls, last_seen_at,
      classification_source, publication_status
    from app.job
    where company_id = ${companyId}::uuid
  `;
}

export async function listJobsForSource(
  database: TransactionSql,
  sourceId: string,
): Promise<readonly ExistingJobRow[]> {
  return database<ExistingJobRow[]>`
    select id, slug, external_job_id, source_url, application_url, title,
      location_text, active, content_hash, missed_crawls, last_seen_at,
      classification_source, publication_status
    from app.job
    where source_id = ${sourceId}::uuid
  `;
}

export type SlugAllocator = (discovered: DiscoveredJob, companySlug: string) => string;

export async function applyCrawlPlan(
  database: TransactionSql,
  companyId: string,
  plan: CrawlChangePlan,
  options: Readonly<{
    missingCrawlThreshold: number;
    now: Date;
    slugFor: SlugAllocator;
    classifyFor: (discovered: DiscoveredJob) => JobClassificationWrite;
    sourceId?: string;
  }>,
): Promise<Readonly<{ newIds: string[]; updatedIds: string[]; reactivatedIds: string[] }>> {
  const newIds: string[] = [];
  const updatedIds: string[] = [];
  const reactivatedIds: string[] = [];
  const existingRows = options.sourceId
    ? await listJobsForSource(database, options.sourceId)
    : await listJobsForCompany(database, companyId);
  const rowsById = new Map(existingRows.map((row) => [row.id, row]));
  const usedSlugs = new Set(existingRows.map((job) => job.slug));
  const companySlug = await companySlugFor(database, companyId);

  for (const discovered of plan.insert) {
    const slug = uniqueSlug(options.slugFor(discovered, companySlug), usedSlugs, discovered);
    usedSlugs.add(slug);
    const classification = options.classifyFor(discovered);
    const rows = await database<{ id: string }[]>`
        insert into app.job (
          company_id, source_id, slug, external_job_id, source_url, application_url, title,
          location_text, description_text, posted_at, application_deadline,
          employment_type, remote_type, salary_min, salary_max, salary_currency,
          salary_period, content_hash, source_payload, enrichment_status,
          first_seen_at, last_seen_at, last_changed_at,
          sector_key, subsector_key, opportunity_type, job_function_key, career_level_key,
          eligibility_status, eligibility_reasons, eligibility_evidence,
          publication_status, classification_source, classification_version
        )
        values (
          ${companyId}::uuid, ${options.sourceId ?? null}::uuid, ${slug}, ${discovered.externalJobId}, ${discovered.sourceUrl},
          ${discovered.applicationUrl}, ${discovered.title}, ${discovered.locationText || null},
          ${discovered.descriptionText || null}, ${discovered.postedAt}, ${discovered.applicationDeadline},
          ${discovered.employmentType}, ${discovered.remoteType}, ${discovered.salaryMin},
          ${discovered.salaryMax}, ${discovered.salaryCurrency}, ${discovered.salaryPeriod},
          ${contentHashForDiscovered(discovered)}, ${jsonParameter(database, discovered.sourcePayload ?? {})},
          'pending', ${options.now}, ${options.now}, ${options.now},
          ${classification.sectorKey}, ${classification.subsectorKey}, ${classification.opportunityType},
          ${classification.jobFunctionKey}, ${classification.careerLevelKey},
          ${classification.eligibilityStatus}, ${classification.eligibilityReasons}, ${classification.eligibilityEvidence},
          ${classification.publicationStatus}, ${classification.classificationSource}, 1
        )
        returning id
      `;
    const insertedId = rows[0]!.id;
    newIds.push(insertedId);
    await replaceJobLocations(database, insertedId, discovered);
  }

  for (const { discovered, existing: job } of plan.update) {
    const row = rowsById.get(job.id);
    if (!row) continue;
    const classification =
      row.classification_source === "administrator" ? null : options.classifyFor(discovered);
    await updateJobFromDiscovered(
      database,
      companyId,
      row,
      discovered,
      options.now,
      false,
      classification,
      options.sourceId,
    );
    if (classification) await replaceJobLocations(database, job.id, discovered);
    updatedIds.push(job.id);
  }

  for (const { discovered, existing: job } of plan.reactivate) {
    const row = rowsById.get(job.id);
    if (!row) continue;
    const classification =
      row.classification_source === "administrator" ? null : options.classifyFor(discovered);
    await updateJobFromDiscovered(
      database,
      companyId,
      row,
      discovered,
      options.now,
      true,
      classification,
      options.sourceId,
    );
    if (classification) await replaceJobLocations(database, job.id, discovered);
    reactivatedIds.push(job.id);
  }

  for (const job of plan.touch) {
    await database`
        update app.job
        set last_seen_at = ${options.now}, missed_crawls = 0, updated_at = now()
        where id = ${job.id}::uuid
      `;
  }

  for (const job of plan.deactivate) {
    await database`
        update app.job
        set active = false,
            publication_status = 'expired',
            missed_crawls = ${options.missingCrawlThreshold},
            updated_at = now()
        where id = ${job.id}::uuid
      `;
  }

  for (const job of plan.incrementMissed) {
    await database`
        update app.job
        set missed_crawls = missed_crawls + 1, updated_at = now()
        where id = ${job.id}::uuid
      `;
  }

  return { newIds, reactivatedIds, updatedIds };
}

async function replaceJobLocations(
  database: TransactionSql,
  jobId: string,
  discovered: DiscoveredJob,
): Promise<void> {
  await database`delete from app.job_location where job_id = ${jobId}::uuid`;
  const locations = [...(discovered.locations ?? [])];
  if (locations.length === 0 && discovered.locationText) {
    const sources = discovered.locationText
      .split(/, | \| /u)
      .map((text) => text.trim())
      .filter(Boolean);
    for (const source of sources) {
      locations.push({
        city: null,
        country: null,
        hybrid: discovered.remoteType === "hybrid",
        onSite: discovered.remoteType === "on_site",
        region: null,
        remote: discovered.remoteType === "remote",
        sourceText: source.slice(0, 200),
      });
    }
  }
  for (const [position, location] of locations.entries()) {
    await database`
      insert into app.job_location (
        job_id, city, region, country, source_text, remote, hybrid, on_site, position
      )
      values (
        ${jobId}::uuid, ${location.city}, ${location.region}, ${location.country},
        ${location.sourceText.slice(0, 200)}, ${location.remote}, ${location.hybrid}, ${location.onSite},
        ${position}
      )
    `;
  }
}

async function updateJobFromDiscovered(
  database: TransactionSql,
  companyId: string,
  existing: ExistingJobRow,
  discovered: DiscoveredJob,
  now: Date,
  reactivate: boolean,
  classification: JobClassificationWrite | null,
  sourceId?: string,
): Promise<void> {
  await database`
    update app.job
    set external_job_id = ${discovered.externalJobId},
        source_url = ${discovered.sourceUrl},
        application_url = ${discovered.applicationUrl},
        title = ${discovered.title},
        location_text = ${discovered.locationText || null},
        description_text = ${discovered.descriptionText || null},
        posted_at = ${discovered.postedAt},
        application_deadline = ${discovered.applicationDeadline},
        employment_type = ${discovered.employmentType},
        remote_type = ${discovered.remoteType},
        salary_min = ${discovered.salaryMin},
        salary_max = ${discovered.salaryMax},
        salary_currency = ${discovered.salaryCurrency},
        salary_period = ${discovered.salaryPeriod},
        content_hash = ${contentHashForDiscovered(discovered)},
        source_payload = ${jsonParameter(database, discovered.sourcePayload ?? {})},
        last_seen_at = ${now},
        last_changed_at = ${now},
        missed_crawls = 0,
        active = case when ${reactivate} then true else active end,
        enrichment_status = 'pending',
        enrichment_model = null,
        enrichment_version = null,
        enrichment_error = null,
        enrichment_attempts = 0,
        enrichment_input_tokens = null,
        enrichment_output_tokens = null,
        enrichment_latency_ms = null,
        normalized_title = null,
        job_category = null,
        seniority_level = null,
        description_summary = null,
        responsibilities = '[]'::jsonb,
        requirements = '[]'::jsonb,
        skills = '[]'::jsonb,
        preferred_skills = '[]'::jsonb,
        degree_requirements = '[]'::jsonb,
        experience_requirements = null,
        visa_sponsorship_status = 'unknown',
        visa_sponsorship_evidence = null,
        sector_key = case when ${classification !== null} then ${classification?.sectorKey ?? null} else sector_key end,
        subsector_key = case when ${classification !== null} then ${classification?.subsectorKey ?? null} else subsector_key end,
        opportunity_type = case when ${classification !== null} then ${classification?.opportunityType ?? "unknown"} else opportunity_type end,
        job_function_key = case when ${classification !== null} then ${classification?.jobFunctionKey ?? null} else job_function_key end,
        career_level_key = case when ${classification !== null} then ${classification?.careerLevelKey ?? null} else career_level_key end,
        eligibility_status = case when ${classification !== null} then ${classification?.eligibilityStatus ?? "needs_review"} else eligibility_status end,
        eligibility_reasons = case when ${classification !== null} then ${classification?.eligibilityReasons ?? []} else eligibility_reasons end,
        eligibility_evidence = case when ${classification !== null} then ${classification?.eligibilityEvidence ?? null} else eligibility_evidence end,
        publication_status = case when ${classification !== null} then ${classification?.publicationStatus ?? "draft"} else publication_status end,
        classification_source = case when ${classification !== null} then ${classification?.classificationSource ?? "deterministic"} else classification_source end,
        classification_version = case when ${classification !== null} then classification_version + 1 else classification_version end,
        updated_at = now()
    where id = ${existing.id}::uuid
      and company_id = ${companyId}::uuid
      and (${sourceId ?? null}::uuid is null or source_id = ${sourceId ?? null}::uuid)
  `;
}

function uniqueSlug(
  base: string,
  usedSlugs: ReadonlySet<string>,
  discovered: DiscoveredJob,
): string {
  if (!usedSlugs.has(base)) return base;
  const suffix = contentHashForDiscovered(discovered).slice(0, 8);
  return `${base.slice(0, 140)}-${suffix}`;
}

async function companySlugFor(database: TransactionSql, companyId: string): Promise<string> {
  const rows = await database<{ slug: string }[]>`
    select slug from app.company where id = ${companyId}::uuid
  `;
  return rows[0]?.slug ?? "company";
}

export type EnrichmentCandidateRow = Readonly<{
  application_deadline: Date | null;
  company_id: string;
  description_text: string | null;
  employment_type: string | null;
  id: string;
  location_text: string | null;
  posted_at: Date | null;
  remote_type: string | null;
  salary_currency: string | null;
  salary_max: number | null;
  salary_min: number | null;
  title: string;
}>;

export async function listPendingEnrichment(
  database: TransactionSql,
  limit: number,
): Promise<EnrichmentCandidateRow[]> {
  return database<EnrichmentCandidateRow[]>`
    select id, company_id, title, location_text, employment_type, remote_type,
      salary_min, salary_max, salary_currency, application_deadline,
      description_text, posted_at
    from app.job
    where active
      and enrichment_status in ('pending', 'failed')
      and enrichment_attempts < 3
      and (enrichment_status = 'pending' or updated_at <= now() - interval '1 hour')
      and description_text is not null
    order by (enrichment_status = 'failed') asc, updated_at asc
    limit ${limit}
  `;
}

export type EnrichmentResultWrite = Readonly<{
  inputTokens: number | null;
  latencyMs: number | null;
  model: string;
  output: Readonly<{
    degreeRequirements: readonly string[];
    descriptionSummary: string;
    employmentType: string | null;
    essentialRequirements: readonly string[];
    experienceRequirements: string | null;
    jobCategory: string | null;
    normalizedTitle: string | null;
    preferredRequirements: readonly string[];
    remoteType: string | null;
    responsibilities: readonly string[];
    seniorityLevel: string | null;
    skills: readonly string[];
    visaSponsorshipEvidence: string | null;
    visaSponsorshipStatus: string;
  }>;
  outputTokens: number | null;
  version: number;
}>;

export async function markEnrichmentCompleted(
  database: TransactionSql,
  jobId: string,
  result: EnrichmentResultWrite,
): Promise<void> {
  await database`
    update app.job
    set normalized_title = ${result.output.normalizedTitle},
        job_category = null,
        seniority_level = ${result.output.seniorityLevel},
        employment_type = coalesce(${result.output.employmentType}, employment_type),
        remote_type = coalesce(${result.output.remoteType}, remote_type),
        responsibilities = ${jsonParameter(database, result.output.responsibilities)},
        requirements = ${database.json(result.output.essentialRequirements)},
        skills = ${jsonParameter(database, result.output.skills)},
        preferred_skills = ${database.json(result.output.preferredRequirements)},
        degree_requirements = ${database.json(result.output.degreeRequirements)},
        experience_requirements = ${result.output.experienceRequirements},
        visa_sponsorship_status = ${result.output.visaSponsorshipStatus},
        visa_sponsorship_evidence = ${result.output.visaSponsorshipEvidence},
        description_summary = ${result.output.descriptionSummary},
        enrichment_status = 'completed',
        enrichment_model = ${result.model},
        enrichment_version = ${result.version},
        enrichment_error = null,
        enrichment_attempts = enrichment_attempts + 1,
        enrichment_input_tokens = ${result.inputTokens},
        enrichment_output_tokens = ${result.outputTokens},
        enrichment_latency_ms = ${result.latencyMs},
        updated_at = now()
    where id = ${jobId}::uuid
  `;
}

export async function markEnrichmentFailed(
  database: TransactionSql,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await database`
    update app.job
    set enrichment_status = 'failed',
        enrichment_error = ${errorMessage.slice(0, 500)},
        enrichment_attempts = enrichment_attempts + 1,
        updated_at = now()
    where id = ${jobId}::uuid
  `;
}

export async function markEnrichmentSkipped(
  database: TransactionSql,
  jobId: string,
  reason: string,
): Promise<void> {
  await database`
    update app.job
    set enrichment_status = 'skipped',
        enrichment_error = ${reason.slice(0, 500)},
        updated_at = now()
    where id = ${jobId}::uuid
  `;
}

export type EligibilityQueueRow = Readonly<{
  company_name: string;
  eligibility_evidence: string | null;
  eligibility_reasons: readonly string[];
  eligibility_status: string;
  id: string;
  opportunity_type: string;
  title: string;
  updated_at: Date;
}>;

export async function listEligibilityReviewQueue(
  database: TransactionSql,
  limit: number,
): Promise<EligibilityQueueRow[]> {
  return database<EligibilityQueueRow[]>`
    select j.id, j.title, j.opportunity_type, j.eligibility_status,
      j.eligibility_reasons, j.eligibility_evidence, j.updated_at,
      c.name as company_name
    from app.job j
    join app.company c on c.id = j.company_id
    where j.active and j.eligibility_status in ('needs_review', 'ineligible')
    order by j.eligibility_status = 'needs_review' desc, j.updated_at asc
    limit ${limit}
  `;
}

export type ClassificationQueueRow = Readonly<{
  company_name: string;
  id: string;
  opportunity_type: string;
  sector_key: string | null;
  subsector_key: string | null;
  title: string;
  updated_at: Date;
}>;

export async function listClassificationReviewQueue(
  database: TransactionSql,
  limit: number,
): Promise<ClassificationQueueRow[]> {
  return database<ClassificationQueueRow[]>`
    select j.id, j.title, j.opportunity_type, j.sector_key, j.subsector_key,
      j.updated_at, c.name as company_name
    from app.job j
    join app.company c on c.id = j.company_id
    where j.active
      and j.publication_status = 'published'
      and j.eligibility_status = 'eligible'
      and (j.sector_key is null or j.subsector_key is null or j.subsector_key = 'other')
    order by j.updated_at asc
    limit ${limit}
  `;
}

export type ClassificationOverrideInput = Readonly<{
  eligibilityStatus?: "eligible" | "ineligible" | "needs_review";
  opportunityType?: string;
  publicationStatus?: "published" | "suppressed" | "draft";
  sectorKey?: string | null;
  subsectorKey?: string | null;
}>;

/**
 * Administrator override of classification/eligibility/publication. Marks the
 * row as administrator-owned so the deterministic crawl pipeline never
 * reclassifies or republishes it, and bumps the classification version.
 */
export async function overrideJobClassification(
  database: TransactionSql,
  jobId: string,
  input: ClassificationOverrideInput,
): Promise<void> {
  const orNull = (value: string | null | undefined): string | null => value ?? null;
  await database`
    update app.job
    set sector_key = case when ${input.sectorKey !== undefined} then ${orNull(input.sectorKey)} else sector_key end,
        subsector_key = case when ${input.subsectorKey !== undefined} then ${orNull(input.subsectorKey)} else subsector_key end,
        opportunity_type = case when ${input.opportunityType !== undefined} then ${orNull(input.opportunityType)} else opportunity_type end,
        eligibility_status = case when ${input.eligibilityStatus !== undefined} then ${orNull(input.eligibilityStatus)} else eligibility_status end,
        publication_status = case when ${input.publicationStatus !== undefined} then ${orNull(input.publicationStatus)} else publication_status end,
        classification_source = 'administrator',
        classification_version = classification_version + 1,
        updated_at = now()
    where id = ${jobId}::uuid
  `;
}

export type ReclassificationRow = Readonly<{
  application_deadline: Date | null;
  classification_source: string;
  description_text: string | null;
  id: string;
  location_text: string | null;
  locations: readonly DiscoveredLocation[];
  source_payload: unknown;
  title: string;
}>;

export async function listJobsForReclassification(
  database: TransactionSql,
): Promise<ReclassificationRow[]> {
  return database<ReclassificationRow[]>`
    select j.id, j.title, j.description_text, j.application_deadline,
      j.source_payload, j.classification_source, j.location_text,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'city', l.city, 'region', l.region, 'country', l.country,
              'sourceText', l.source_text, 'remote', l.remote,
              'hybrid', l.hybrid, 'onSite', l.on_site
            )
            order by l.position
          )
          from app.job_location l
          where l.job_id = j.id
        ),
        '[]'::jsonb
      ) as locations
    from app.job j
    where j.active and j.classification_source <> 'administrator'
    order by j.updated_at asc
  `;
}

export async function applyDeterministicClassification(
  database: TransactionSql,
  jobId: string,
  classification: JobClassificationWrite,
): Promise<void> {
  await database`
    update app.job
    set sector_key = ${classification.sectorKey},
        subsector_key = ${classification.subsectorKey},
        opportunity_type = ${classification.opportunityType},
        eligibility_status = ${classification.eligibilityStatus},
        eligibility_reasons = ${classification.eligibilityReasons},
        eligibility_evidence = ${classification.eligibilityEvidence},
        publication_status = ${classification.publicationStatus},
        classification_source = 'deterministic',
        classification_version = classification_version + 1,
        updated_at = now()
    where id = ${jobId}::uuid and classification_source <> 'administrator'
  `;
}
