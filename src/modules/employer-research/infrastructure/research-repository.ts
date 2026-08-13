import type { TransactionSql } from "postgres";
import { jsonParameter } from "../../job-catalog/infrastructure/crawler-database";
import type { EmployerResearchRow } from "../domain/research-row";

export type ResearchImportState = Readonly<{
  companies: readonly { id: string; name: string; slug: string; websiteUrl: string | null }[];
  aliases: readonly { alias: string; companyId: string }[];
  existingSlugs: ReadonlySet<string>;
  existingSponsorKeys: ReadonlySet<string>;
  existingSnapshotKeys: ReadonlySet<string>;
  existingCandidateKeys: ReadonlySet<string>;
  liveSourceCompanyIds: ReadonlySet<string>;
}>;

export async function readResearchImportState(
  database: TransactionSql,
  datasetVersion: string,
  researchDate: string,
): Promise<ResearchImportState> {
  const companies = await database<
    { id: string; name: string; slug: string; websiteUrl: string | null }[]
  >`
    select id, name, slug, website_url as "websiteUrl" from app.company
  `;
  const aliases = await database<{ alias: string; companyId: string }[]>`
    select alias, company_id as "companyId" from app.employer_alias
  `;
  const sponsors = await database<{ legalName: string }[]>`
    select legal_name as "legalName" from app.employer_sponsor_entity
    where source_snapshot_date = ${researchDate}::date
  `;
  const snapshots = await database<{ rank: number }[]>`
    select internal_rank as rank from app.employer_research_snapshot
    where dataset_version = ${datasetVersion} and research_date = ${researchDate}::date
  `;
  const candidates = await database<{ companyId: string | null; url: string }[]>`
    select company_id as "companyId", candidate_url as url from app.job_source_candidate
  `;
  const liveSources = await database<{ companyId: string }[]>`
    select distinct company_id as "companyId" from app.job_source
  `;
  return {
    companies,
    aliases,
    existingSlugs: new Set(companies.map((company) => company.slug)),
    existingSponsorKeys: new Set(
      sponsors.map((sponsor) => `${sponsor.legalName.trim().toLowerCase()}@${researchDate}`),
    ),
    existingSnapshotKeys: new Set(
      snapshots.map((snapshot) => `${datasetVersion}@${researchDate}@${snapshot.rank}`),
    ),
    existingCandidateKeys: new Set(
      candidates.map((candidate) => `${candidate.companyId ?? "unresolved"}@${candidate.url}`),
    ),
    liveSourceCompanyIds: new Set(liveSources.map((source) => source.companyId)),
  };
}

export async function createResearchEmployer(
  database: TransactionSql,
  input: Readonly<{
    canonicalEmployer: string;
    slug: string;
    websiteUrl: string | null;
    careerSearchUrl: string | null;
  }>,
): Promise<string> {
  const rows = await database<{ id: string }[]>`
    insert into app.company (
      name, slug, website_url, careers_url, source_type, crawl_allowed, active,
      directory_visible, notes
    ) values (
      ${input.canonicalEmployer}, ${input.slug}, ${input.websiteUrl ?? null},
      ${input.careerSearchUrl ?? input.websiteUrl ?? `https://employer.invalid/${input.slug}`},
      'unknown', 'unknown', true, false,
      'Created by the Top 1,000 employer research import; no live source configured.'
    )
    on conflict (slug) do update set name = excluded.name, updated_at = now()
    returning id
  `;
  return rows[0]!.id;
}

export async function fillCompanyWebsite(
  database: TransactionSql,
  companyId: string,
  websiteUrl: string,
): Promise<void> {
  await database`
    update app.company set website_url = ${websiteUrl}, updated_at = now()
    where id = ${companyId}::uuid and website_url is null
  `;
}

export async function upsertEmployerAlias(
  database: TransactionSql,
  input: Readonly<{ companyId: string; alias: string; aliasType: string; source: string }>,
): Promise<"inserted" | "unchanged"> {
  const rows = await database<{ id: string }[]>`
    insert into app.employer_alias (company_id, alias, alias_type, source)
    values (${input.companyId}::uuid, ${input.alias}, ${input.aliasType}, ${input.source})
    on conflict (company_id, alias) do nothing
    returning id
  `;
  return rows.length === 1 ? "inserted" : "unchanged";
}

export async function upsertSponsorEntity(
  database: TransactionSql,
  input: Readonly<{
    companyId: string | null;
    legalName: string;
    townCity: string | null;
    routes: readonly string[];
    snapshotDate: string;
    identityConfidence: string | null;
    identityNotes: string | null;
    sourceReference: string;
  }>,
): Promise<"inserted" | "updated" | "unchanged"> {
  const existing = await database<{ id: string; company_id: string | null; routes: string[] }[]>`
    select id, company_id, routes from app.employer_sponsor_entity
    where legal_name = ${input.legalName} and source_snapshot_date = ${input.snapshotDate}::date
  `;
  if (existing.length === 0) {
    await database`
      insert into app.employer_sponsor_entity (
        company_id, legal_name, town_city, routes, source_snapshot_date,
        identity_confidence, identity_notes, source_reference
      ) values (
        ${input.companyId ?? null}::uuid, ${input.legalName}, ${input.townCity ?? null},
        ${database.array([...input.routes])}, ${input.snapshotDate}::date,
        ${input.identityConfidence ?? null}, ${input.identityNotes ?? null},
        ${input.sourceReference}
      )
    `;
    return "inserted";
  }
  const row = existing[0]!;
  const sameCompany = (row.company_id ?? null) === (input.companyId ?? null);
  const sameRoutes =
    JSON.stringify([...(row.routes ?? [])].sort()) === JSON.stringify([...input.routes].sort());
  if (sameCompany && sameRoutes) return "unchanged";
  await database`
    update app.employer_sponsor_entity
    set company_id = ${input.companyId ?? null}::uuid,
        routes = ${database.array([...input.routes])},
        town_city = ${input.townCity ?? null},
        identity_confidence = ${input.identityConfidence ?? null},
        identity_notes = ${input.identityNotes ?? null},
        updated_at = now()
    where id = ${row.id}::uuid
  `;
  return "updated";
}

export async function upsertResearchSnapshot(
  database: TransactionSql,
  input: Readonly<{
    companyId: string | null;
    row: EmployerResearchRow;
    datasetVersion: string;
    researchDate: string;
  }>,
): Promise<"inserted" | "updated" | "unchanged"> {
  const existing = await database<{ id: string; company_id: string | null }[]>`
    select id, company_id from app.employer_research_snapshot
    where dataset_version = ${input.datasetVersion}
      and research_date = ${input.researchDate}::date
      and internal_rank = ${input.row.rank}
  `;
  const values = snapshotValues(input);
  if (existing.length === 0) {
    await database`
      insert into app.employer_research_snapshot (
        company_id, canonical_name, dataset_version, research_date, priority_tier, internal_rank,
        crawler_wave, employer_value_score, crawler_readiness_score,
        crawler_priority_score, sponsorship_score, early_career_score, scale_score,
        brand_market_score, uk_relevance_score, sector_score,
        listing_ownership_score, source_leverage_score, sector, subsector,
        finance_asset_class, employee_count, employee_band, employee_scope,
        employee_source, employee_confidence, ownership_type, ownership_confidence,
        ticker, exchange, identity_confidence, research_status, evidence_urls, notes,
        ats_platform, ats_verification_status
      ) values (
        ${values.companyId ?? null}::uuid, ${values.canonicalName}, ${values.datasetVersion},
        ${values.researchDate}::date, ${values.priorityTier}, ${values.internalRank}, ${values.crawlerWave},
        ${values.employerValueScore}, ${values.crawlerReadinessScore}, ${values.crawlerPriorityScore},
        ${values.sponsorshipScore}, ${values.earlyCareerScore}, ${values.scaleScore},
        ${values.brandMarketScore}, ${values.ukRelevanceScore}, ${values.sectorScore},
        ${values.listingOwnershipScore}, ${values.sourceLeverageScore}, ${values.sector},
        ${values.subsector}, ${values.financeAssetClass}, ${values.employeeCount},
        ${values.employeeBand}, ${values.employeeScope}, ${values.employeeSource},
        ${values.employeeConfidence}, ${values.ownershipType}, ${values.ownershipConfidence},
        ${values.ticker}, ${values.exchange}, ${values.identityConfidence},
        ${values.researchStatus}, ${jsonParameter(database, values.evidenceUrls)}, ${values.notes},
        ${values.atsPlatform}, ${values.atsVerificationStatus}
      )
    `;
    return "inserted";
  }
  const row = existing[0]!;
  if ((row.company_id ?? null) === (values.companyId ?? null)) return "unchanged";
  await database`
    update app.employer_research_snapshot
    set company_id = ${values.companyId ?? null}::uuid,
        canonical_name = ${values.canonicalName},
        priority_tier = ${values.priorityTier},
        employer_value_score = ${values.employerValueScore},
        crawler_readiness_score = ${values.crawlerReadinessScore},
        crawler_priority_score = ${values.crawlerPriorityScore},
        research_status = ${values.researchStatus},
        ats_platform = ${values.atsPlatform},
        ats_verification_status = ${values.atsVerificationStatus},
        updated_at = now()
    where id = ${row.id}::uuid
  `;
  return "updated";
}

function snapshotValues(
  input: Readonly<{
    companyId: string | null;
    row: EmployerResearchRow;
    datasetVersion: string;
    researchDate: string;
  }>,
) {
  return {
    companyId: input.companyId,
    canonicalName: input.row.canonicalEmployer,
    datasetVersion: input.datasetVersion,
    researchDate: input.researchDate,
    priorityTier: input.row.priorityTier,
    internalRank: input.row.rank,
    crawlerWave: input.row.crawlerWave,
    employerValueScore: input.row.employerValueScore,
    crawlerReadinessScore: input.row.crawlerReadinessScore,
    crawlerPriorityScore: input.row.crawlerPriorityScore,
    sponsorshipScore: input.row.sponsorshipScore,
    earlyCareerScore: input.row.earlyCareerScore,
    scaleScore: input.row.scaleScore,
    brandMarketScore: input.row.brandMarketScore,
    ukRelevanceScore: input.row.ukRelevanceScore,
    sectorScore: input.row.sectorScore,
    listingOwnershipScore: input.row.listingOwnershipScore,
    sourceLeverageScore: input.row.sourceLeverageScore,
    sector: input.row.sector,
    subsector: input.row.subsector,
    financeAssetClass: input.row.financeAssetClass,
    employeeCount: input.row.employeeCount,
    employeeBand: input.row.employeeBand,
    employeeScope: input.row.employeeScope,
    employeeSource: input.row.employeeSource,
    employeeConfidence: input.row.employeeConfidence,
    ownershipType: input.row.ownership,
    ownershipConfidence: input.row.ownershipConfidence,
    ticker: input.row.ticker,
    exchange: input.row.exchange,
    identityConfidence: input.row.identityConfidence,
    researchStatus: input.row.researchStatus ?? "not_researched",
    evidenceUrls: [...input.row.evidenceUrls],
    notes: input.row.notes,
    atsPlatform: input.row.atsPlatform,
    atsVerificationStatus: input.row.atsVerificationStatus,
  };
}

export async function upsertSourceCandidate(
  database: TransactionSql,
  input: Readonly<{
    companyId: string | null;
    row: EmployerResearchRow;
  }>,
): Promise<"inserted" | "unchanged"> {
  const url = input.row.careerSearchUrl!;
  const existing = await database<{ id: string }[]>`
    select id from app.job_source_candidate
    where company_id = ${input.companyId ?? null}::uuid and candidate_url = ${url}
  `;
  if (existing.length > 0) return "unchanged";
  await database`
    insert into app.job_source_candidate (
      company_id, channel, candidate_url, platform_hint, ats_verification_status,
      discovery_method, status, confidence, evidence, research_status, notes
    ) values (
      ${input.companyId ?? null}::uuid, 'general', ${url}, ${input.row.atsPlatform ?? null},
      ${input.row.atsVerificationStatus ?? null},
      ${input.row.recommendedDiscoveryStrategy ?? null},
      ${candidateStatus(input.row)}, ${input.row.identityConfidence ?? null},
      ${input.row.atsEvidenceNotes ?? null}, ${input.row.researchStatus ?? null},
      ${input.row.currentJobsScopeNote ?? null}
    )
  `;
  return "inserted";
}

function candidateStatus(row: EmployerResearchRow): string {
  if (row.researchStatus === "blocked_review") return "blocked";
  if (row.atsVerificationStatus?.toLowerCase().includes("blocked")) return "blocked";
  if (row.researchStatus === "verified_platform" || row.researchStatus === "verified_careers_url") {
    return "verified";
  }
  if (row.atsPlatform && row.atsPlatform !== "Not researched") return "platform_identified";
  return "candidate_found";
}

export type ResearchViewRow = Readonly<{
  companyId: string | null;
  name: string;
  slug: string | null;
  websiteUrl: string | null;
  tier: string | null;
  employerValueScore: number | null;
  crawlerPriorityScore: number | null;
  sector: string | null;
  employeeBand: string | null;
  ownership: string | null;
  identityConfidence: string | null;
  researchStatus: string | null;
  researchDate: Date | null;
  sponsorEntities: number;
  sourceCandidates: number;
  liveSources: number;
  currentJobs: number;
  atsProviders: string | null;
}>;

export async function listEmployerResearchRows(
  database: TransactionSql,
): Promise<ResearchViewRow[]> {
  return database<ResearchViewRow[]>`
    with latest_snapshot as (
      select distinct on (coalesce(company_id::text, 'unresolved:' || internal_rank::text)) *
      from app.employer_research_snapshot
      order by coalesce(company_id::text, 'unresolved:' || internal_rank::text), research_date desc, dataset_version desc
    )
    select
      c.id as "companyId",
      coalesce(c.name, s.canonical_name) as name,
      c.slug as slug,
      c.website_url as "websiteUrl",
      s.priority_tier as tier,
      s.employer_value_score as "employerValueScore",
      s.crawler_priority_score as "crawlerPriorityScore",
      s.sector as sector,
      s.employee_band as "employeeBand",
      s.ownership_type as ownership,
      s.identity_confidence as "identityConfidence",
      s.research_status as "researchStatus",
      s.research_date as "researchDate",
      (select count(*)::int from app.employer_sponsor_entity e where e.company_id = c.id) as "sponsorEntities",
      (select count(*)::int from app.job_source_candidate jc where jc.company_id = c.id) as "sourceCandidates",
      (select count(*)::int from app.job_source js where js.company_id = c.id) as "liveSources",
      (select count(*)::int from app.job j where j.company_id = c.id) as "currentJobs",
      (select string_agg(distinct js2.ats_provider, ', ' order by js2.ats_provider)
        from app.job_source js2 where js2.company_id = c.id) as "atsProviders"
    from app.company c
    left join latest_snapshot s on s.company_id = c.id
    union all
    select
      null::uuid as "companyId",
      s.canonical_name as name,
      null as slug,
      null as "websiteUrl",
      s.priority_tier as tier,
      s.employer_value_score as "employerValueScore",
      s.crawler_priority_score as "crawlerPriorityScore",
      s.sector as sector,
      s.employee_band as "employeeBand",
      s.ownership_type as ownership,
      s.identity_confidence as "identityConfidence",
      s.research_status as "researchStatus",
      s.research_date as "researchDate",
      0 as "sponsorEntities",
      0 as "sourceCandidates",
      0 as "liveSources",
      0 as "currentJobs",
      null as "atsProviders"
    from latest_snapshot s
    where s.company_id is null
    order by name
  `;
}

export async function listAliasTextByCompany(
  database: TransactionSql,
): Promise<readonly { alias: string; companyId: string }[]> {
  return database<{ alias: string; companyId: string }[]>`
    select alias, company_id as "companyId" from app.employer_alias
  `;
}

export type EmployerDetailSnapshot = Readonly<{
  id: string;
  companyId: string | null;
  canonicalName: string;
  datasetVersion: string;
  researchDate: Date;
  priorityTier: string;
  internalRank: number;
  crawlerWave: string | null;
  employerValueScore: number | null;
  crawlerReadinessScore: number | null;
  crawlerPriorityScore: number | null;
  sponsorshipScore: number | null;
  earlyCareerScore: number | null;
  scaleScore: number | null;
  brandMarketScore: number | null;
  ukRelevanceScore: number | null;
  sector: string | null;
  subsector: string | null;
  employeeBand: string | null;
  employeeScope: string | null;
  employeeSource: string | null;
  employeeConfidence: string | null;
  ownershipType: string | null;
  ticker: string | null;
  exchange: string | null;
  identityConfidence: string | null;
  researchStatus: string;
  evidenceUrls: readonly string[];
  notes: string | null;
  atsPlatform: string | null;
}>;

export type EmployerSponsorDetail = Readonly<{
  id: string;
  legalName: string;
  townCity: string | null;
  sponsorRating: string | null;
  routes: readonly string[];
  sourceSnapshotDate: Date;
  activeInSnapshot: boolean;
  identityConfidence: string | null;
  identityNotes: string | null;
  sourceReference: string | null;
}>;

export type EmployerCandidateDetail = Readonly<{
  id: string;
  candidateUrl: string | null;
  candidateEndpoint: string | null;
  platformHint: string | null;
  atsVerificationStatus: string | null;
  status: string;
  confidence: string | null;
  discoveryMethod: string | null;
  verifiedAt: Date | null;
  notes: string | null;
}>;

export type EmployerLiveSourceDetail = Readonly<{
  id: string;
  slug: string;
  name: string;
  channel: string;
  careersUrl: string;
  crawlEndpointUrl: string | null;
  atsProvider: string | null;
  sourceType: string;
  status: string;
  needsBrowser: boolean;
  landingHealthStatus: string;
  endpointHealthStatus: string;
  lastCheckedAt: Date | null;
  nextCheckAt: Date | null;
  consecutiveFailures: number;
  verificationDate: Date | null;
}>;

export type EmployerDetailRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  careersUrl: string | null;
  employerIndustryKey: string | null;
  employerSubindustryKey: string | null;
  description: string | null;
  active: boolean;
  aliases: readonly { alias: string; aliasType: string; source: string }[];
  snapshot: EmployerDetailSnapshot | null;
  sponsors: readonly EmployerSponsorDetail[];
  candidates: readonly EmployerCandidateDetail[];
  liveSources: readonly EmployerLiveSourceDetail[];
}>;

export async function findEmployerDetail(
  database: TransactionSql,
  companyId: string,
): Promise<EmployerDetailRow | null> {
  const [companies, aliases, snapshots, sponsors, candidates, sources] = await Promise.all([
    database<
      {
        id: string;
        slug: string;
        name: string;
        websiteUrl: string | null;
        careersUrl: string | null;
        employerIndustryKey: string | null;
        employerSubindustryKey: string | null;
        description: string | null;
        active: boolean;
      }[]
    >`
      select id, slug, name, website_url as "websiteUrl", careers_url as "careersUrl",
        employer_industry_key as "employerIndustryKey",
        employer_subindustry_key as "employerSubindustryKey",
        description, active
      from app.company where id = ${companyId}::uuid
    `,
    database<{ alias: string; aliasType: string; source: string }[]>`
      select alias, alias_type as "aliasType", source
      from app.employer_alias where company_id = ${companyId}::uuid order by alias
    `,
    database<
      {
        id: string;
        companyId: string | null;
        canonicalName: string;
        datasetVersion: string;
        researchDate: Date;
        priorityTier: string;
        internalRank: number;
        crawlerWave: string | null;
        employerValueScore: string | null;
        crawlerReadinessScore: string | null;
        crawlerPriorityScore: string | null;
        sponsorshipScore: string | null;
        earlyCareerScore: string | null;
        scaleScore: string | null;
        brandMarketScore: string | null;
        ukRelevanceScore: string | null;
        sector: string | null;
        subsector: string | null;
        employeeBand: string | null;
        employeeScope: string | null;
        employeeSource: string | null;
        employeeConfidence: string | null;
        ownershipType: string | null;
        ticker: string | null;
        exchange: string | null;
        identityConfidence: string | null;
        researchStatus: string;
        evidenceUrls: readonly string[];
        notes: string | null;
        atsPlatform: string | null;
      }[]
    >`
      select id, company_id as "companyId", canonical_name as "canonicalName",
        dataset_version as "datasetVersion", research_date as "researchDate",
        priority_tier as "priorityTier", internal_rank as "internalRank",
        crawler_wave as "crawlerWave", employer_value_score as "employerValueScore",
        crawler_readiness_score as "crawlerReadinessScore",
        crawler_priority_score as "crawlerPriorityScore",
        sponsorship_score as "sponsorshipScore", early_career_score as "earlyCareerScore",
        scale_score as "scaleScore", brand_market_score as "brandMarketScore",
        uk_relevance_score as "ukRelevanceScore", sector, subsector,
        employee_band as "employeeBand", employee_scope as "employeeScope",
        employee_source as "employeeSource", employee_confidence as "employeeConfidence",
        ownership_type as "ownershipType", ticker, exchange,
        identity_confidence as "identityConfidence", research_status as "researchStatus",
        evidence_urls as "evidenceUrls", notes, ats_platform as "atsPlatform"
      from app.employer_research_snapshot
      where company_id = ${companyId}::uuid
      order by research_date desc, dataset_version desc
      limit 3
    `,
    database<EmployerSponsorDetail[]>`
      select id, legal_name as "legalName", town_city as "townCity",
        sponsor_rating as "sponsorRating", routes,
        source_snapshot_date as "sourceSnapshotDate", active_in_snapshot as "activeInSnapshot",
        identity_confidence as "identityConfidence", identity_notes as "identityNotes",
        source_reference as "sourceReference"
      from app.employer_sponsor_entity
      where company_id = ${companyId}::uuid
      order by source_snapshot_date desc, legal_name
    `,
    database<EmployerCandidateDetail[]>`
      select id, candidate_url as "candidateUrl", candidate_endpoint as "candidateEndpoint",
        platform_hint as "platformHint", ats_verification_status as "atsVerificationStatus",
        status, confidence, discovery_method as "discoveryMethod",
        verified_at as "verifiedAt", notes
      from app.job_source_candidate
      where company_id = ${companyId}::uuid
      order by updated_at desc
    `,
    database<EmployerLiveSourceDetail[]>`
      select id, slug, name, channel, careers_url as "careersUrl",
        crawl_endpoint_url as "crawlEndpointUrl", ats_provider as "atsProvider",
        source_type as "sourceType", status, needs_browser as "needsBrowser",
        landing_health_status as "landingHealthStatus",
        endpoint_health_status as "endpointHealthStatus",
        last_checked_at as "lastCheckedAt", next_check_at as "nextCheckAt",
        consecutive_failures as "consecutiveFailures",
        verification_date as "verificationDate"
      from app.job_source
      where company_id = ${companyId}::uuid
      order by status asc, name
    `,
  ]);
  const company = companies[0];
  if (!company) return null;
  const snapshot = snapshots[0];
  return {
    ...company,
    aliases,
    snapshot: snapshot
      ? {
          ...snapshot,
          employerValueScore: score(snapshot.employerValueScore),
          crawlerReadinessScore: score(snapshot.crawlerReadinessScore),
          crawlerPriorityScore: score(snapshot.crawlerPriorityScore),
          sponsorshipScore: score(snapshot.sponsorshipScore),
          earlyCareerScore: score(snapshot.earlyCareerScore),
          scaleScore: score(snapshot.scaleScore),
          brandMarketScore: score(snapshot.brandMarketScore),
          ukRelevanceScore: score(snapshot.ukRelevanceScore),
        }
      : null,
    sponsors,
    candidates,
    liveSources: sources,
  };
}

function score(value: string | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type SourceCapabilityStats = Readonly<{
  liveSources: number;
  browserSources: number;
  httpSources: number;
  jobsByAts: readonly { atsProvider: string | null; count: number }[];
  sourcesByType: readonly { sourceType: string; needsBrowser: boolean; count: number }[];
  verifiedCandidates: number;
  platformIdentifiedCandidates: number;
  employersWithCareersUrl: number;
  employersWithLiveSource: number;
  employersWithJobs: number;
}>;

export async function readSourceCapabilityStats(
  database: TransactionSql,
): Promise<SourceCapabilityStats> {
  const [sources, jobsByAts, candidates, employers] = await Promise.all([
    database<{ needsBrowser: boolean; sourceType: string }[]>`
      select needs_browser as "needsBrowser", source_type as "sourceType" from app.job_source
    `,
    database<{ atsProvider: string | null; count: number }[]>`
      select ats_provider as "atsProvider", count(*)::int as count
      from app.job_source group by ats_provider order by count(*) desc
    `,
    database<{ status: string }[]>`
      select status from app.job_source_candidate
    `,
    database<{ hasCareersUrl: boolean; hasSource: boolean; hasJobs: boolean }[]>`
      select
        (coalesce(nullif(website_url, ''), careers_url) not like '%employer.invalid%') as "hasCareersUrl",
        exists (select 1 from app.job_source js where js.company_id = c.id) as "hasSource",
        exists (select 1 from app.job j where j.company_id = c.id) as "hasJobs"
      from app.company c
    `,
  ]);
  const browserSources = sources.filter((source) => source.needsBrowser).length;
  const typeCounts = new Map<string, { needsBrowser: boolean; count: number }>();
  for (const source of sources) {
    const key = source.sourceType;
    const existing = typeCounts.get(key);
    if (existing) existing.count += 1;
    else typeCounts.set(key, { needsBrowser: source.needsBrowser, count: 1 });
  }
  return {
    liveSources: sources.length,
    browserSources,
    httpSources: sources.length - browserSources,
    jobsByAts: jobsByAts,
    sourcesByType: [...typeCounts.entries()].map(([sourceType, entry]) => ({
      sourceType,
      needsBrowser: entry.needsBrowser,
      count: entry.count,
    })),
    verifiedCandidates: candidates.filter(
      (candidate) => candidate.status === "verified" || candidate.status === "promoted",
    ).length,
    platformIdentifiedCandidates: candidates.filter(
      (candidate) =>
        candidate.status === "platform_identified" || candidate.status === "endpoint_identified",
    ).length,
    employersWithCareersUrl: employers.filter((employer) => employer.hasCareersUrl).length,
    employersWithLiveSource: employers.filter((employer) => employer.hasSource).length,
    employersWithJobs: employers.filter((employer) => employer.hasJobs).length,
  };
}
