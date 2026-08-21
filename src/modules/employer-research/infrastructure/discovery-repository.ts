import type { Sql, TransactionSql } from "postgres";

import { jsonParameter } from "../../job-catalog/infrastructure/crawler-database";
import { platformLabel, sourceTypeForPlatform, type AtsPlatform } from "../domain/ats-fingerprint";
import { slugifyEmployerName } from "../domain/identity-match";
import type { SourceAutomationPlan } from "../domain/source-automation";

export type DiscoveryCandidate = Readonly<{
  candidateId: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  tier: string | null;
  crawlerPriorityScore: number | null;
  candidateUrl: string;
  candidateEndpoint: string | null;
  platformHint: string | null;
  channel: string;
  status: string;
  confidence: string | null;
  discoveryMethod: string | null;
  researchStatus: string | null;
  atsVerificationStatus: string | null;
  verifiedAt: Date | null;
  liveSources: number;
  atsProviders: string | null;
}>;

export type DiscoveryFilters = Readonly<{
  candidateId: string | null;
  companySlug: string | null;
  tier: string | null;
  platform: string | null;
  status: string | null;
  search: string | null;
  limit: number;
  offset?: number;
}>;

export async function listDiscoveryCandidates(
  database: TransactionSql,
  filters: DiscoveryFilters,
): Promise<DiscoveryCandidate[]> {
  const rows = await database.unsafe<Record<string, unknown>[]>(
    `
    with latest_snapshot as (
      select distinct on (coalesce(company_id::text, 'unresolved:' || internal_rank::text)) *
      from app.employer_research_snapshot
      order by coalesce(company_id::text, 'unresolved:' || internal_rank::text),
        research_date desc, dataset_version desc
    )
    select
      jc.id as "candidateId",
      c.id as "companyId",
      c.name as "companyName",
      c.slug as "companySlug",
      s.priority_tier as tier,
      s.crawler_priority_score as "crawlerPriorityScore",
      jc.candidate_url as "candidateUrl",
      jc.candidate_endpoint as "candidateEndpoint",
      jc.platform_hint as "platformHint",
      jc.channel as channel,
      jc.status as status,
      jc.confidence as confidence,
      jc.discovery_method as "discoveryMethod",
      jc.research_status as "researchStatus",
      jc.ats_verification_status as "atsVerificationStatus",
      jc.verified_at as "verifiedAt",
      (select count(*)::int from app.job_source js
        where js.company_id = c.id and js.status = 'active') as "liveSources",
      (select string_agg(distinct js2.ats_provider, ', ' order by js2.ats_provider)
        from app.job_source js2
        where js2.company_id = c.id and js2.status = 'active') as "atsProviders"
    from app.job_source_candidate jc
    join app.company c on c.id = jc.company_id
    left join latest_snapshot s on s.company_id = c.id
    where 1 = 1
      and ($1::uuid is null or jc.id = $1)
      and ($2::text is null or c.slug = $2)
      and ($3::text is null or s.priority_tier = $3)
      and ($4::text is null or lower(jc.platform_hint) = lower($4))
      and ($5::text is null or jc.status = $5)
      and (
        $6::text is null
        or c.name ilike '%' || $6 || '%'
        or c.slug ilike '%' || $6 || '%'
      )
    order by coalesce(s.crawler_priority_score, 0) desc, c.name asc
    limit $7
    offset $8
  `,
    [
      filters.candidateId ?? null,
      filters.companySlug ?? null,
      filters.tier ?? null,
      filters.platform ?? null,
      filters.status ?? null,
      filters.search ?? null,
      filters.limit,
      filters.offset ?? 0,
    ],
  );
  return rows.map((row) => ({
    candidateId: row.candidateId as string,
    companyId: row.companyId as string,
    companyName: row.companyName as string,
    companySlug: row.companySlug as string,
    tier: (row.tier as string | null) ?? null,
    crawlerPriorityScore: (row.crawlerPriorityScore as number | null) ?? null,
    candidateUrl: row.candidateUrl as string,
    candidateEndpoint: (row.candidateEndpoint as string | null) ?? null,
    platformHint: (row.platformHint as string | null) ?? null,
    channel: (row.channel as string) ?? "general",
    status: row.status as string,
    confidence: (row.confidence as string | null) ?? null,
    discoveryMethod: (row.discoveryMethod as string | null) ?? null,
    researchStatus: (row.researchStatus as string | null) ?? null,
    atsVerificationStatus: (row.atsVerificationStatus as string | null) ?? null,
    verifiedAt: (row.verifiedAt as Date | null) ?? null,
    liveSources: (row.liveSources as number) ?? 0,
    atsProviders: (row.atsProviders as string | null) ?? null,
  }));
}

export type PlatformCoverageSourceData = Readonly<{
  snapshots: readonly {
    companyId: string | null;
    tier: string | null;
    atsPlatform: string | null;
  }[];
  candidates: readonly {
    companyId: string | null;
    platformHint: string | null;
    status: string;
  }[];
  jobSources: readonly { companyId: string | null; atsProvider: string | null }[];
}>;

export async function readPlatformCoverageData(
  database: TransactionSql,
): Promise<PlatformCoverageSourceData> {
  const [snapshots, candidates, jobSources] = await Promise.all([
    database<{ companyId: string | null; tier: string | null; atsPlatform: string | null }[]>`
      select distinct on (company_id)
        company_id as "companyId", priority_tier as tier, ats_platform as "atsPlatform"
      from app.employer_research_snapshot
      where company_id is not null
      order by company_id, research_date desc, dataset_version desc
    `,
    database<{ companyId: string | null; platformHint: string | null; status: string }[]>`
      select company_id as "companyId", platform_hint as "platformHint", status
      from app.job_source_candidate
    `,
    database<{ companyId: string | null; atsProvider: string | null }[]>`
      select company_id as "companyId", ats_provider as "atsProvider"
      from app.job_source
      where status = 'active'
    `,
  ]);
  return { snapshots, candidates, jobSources };
}

export type FingerprintWrite = Readonly<{
  platform: AtsPlatform;
  confidence: string;
  evidence: readonly string[];
  status: string;
}>;

export async function updateCandidateFingerprint(
  database: TransactionSql,
  candidateId: string,
  write: FingerprintWrite,
): Promise<"updated" | "unchanged"> {
  const existing = await database<
    { platformHint: string | null; status: string; evidence: string | null }[]
  >`
    select platform_hint as "platformHint", status, evidence
    from app.job_source_candidate
    where id = ${candidateId}::uuid
  `;
  const row = existing[0];
  if (!row) return "unchanged";
  const evidence = write.evidence.join("\n");
  if (
    (row.platformHint ?? null) === platformLabel(write.platform) &&
    row.status === write.status &&
    (row.evidence ?? null) === evidence
  ) {
    return "unchanged";
  }
  await database`
    update app.job_source_candidate
    set platform_hint = ${platformLabel(write.platform)},
        status = ${write.status},
        confidence = ${write.confidence},
        evidence = ${evidence},
        discovery_method = 'ats_fingerprint',
        updated_at = now()
    where id = ${candidateId}::uuid
  `;
  return "updated";
}

export async function markCandidateVerified(
  database: TransactionSql,
  candidateId: string,
  evidenceNote: string,
  verificationStatus = "verified",
  candidateEndpoint: string | null = null,
): Promise<"updated" | "unchanged"> {
  const existing = await database<{ atsVerificationStatus: string | null; status: string }[]>`
    select ats_verification_status as "atsVerificationStatus", status
    from app.job_source_candidate
    where id = ${candidateId}::uuid
  `;
  const row = existing[0];
  if (!row) return "unchanged";
  if (row.atsVerificationStatus === verificationStatus && row.status === "verified") {
    return "unchanged";
  }
  await database`
    update app.job_source_candidate
    set ats_verification_status = ${verificationStatus},
        status = case when status = 'promoted' then status else 'verified' end,
        verified_at = now(),
        evidence = case
          when evidence is null or evidence = '' then ${evidenceNote}
          else evidence || E'\\n' || ${evidenceNote}
        end,
        candidate_endpoint = coalesce(${candidateEndpoint}, candidate_endpoint),
        updated_at = now()
    where id = ${candidateId}::uuid
  `;
  return "updated";
}

export async function findJobSourceByCompanyAndUrl(
  database: TransactionSql,
  companyId: string,
  url: string,
): Promise<{ id: string; slug: string; status: string; manuallyOverridden: boolean } | null> {
  const rows = await database<
    { id: string; slug: string; status: string; manuallyOverridden: boolean }[]
  >`
    select id, slug, status, manually_overridden as "manuallyOverridden"
    from app.job_source
    where company_id = ${companyId}::uuid
      and (lower(careers_url) = lower(${url}) or lower(crawl_endpoint_url) = lower(${url}))
    limit 1
  `;
  return rows[0] ?? null;
}

export type EmployerMissingCandidate = Readonly<{
  companyId: string;
  companyName: string;
  companySlug: string;
  tier: string | null;
  crawlerPriorityScore: number | null;
  homepageUrl: string;
}>;

export async function listEmployersMissingCandidates(
  database: TransactionSql,
  filters: Readonly<{ tier: string | null; limit: number }>,
): Promise<EmployerMissingCandidate[]> {
  const rows = await database.unsafe<Record<string, unknown>[]>(
    `
    with latest_snapshot as (
      select distinct on (coalesce(company_id::text, 'unresolved:' || internal_rank::text)) *
      from app.employer_research_snapshot
      order by coalesce(company_id::text, 'unresolved:' || internal_rank::text),
        research_date desc, dataset_version desc
    )
    select
      c.id as "companyId",
      c.name as "companyName",
      c.slug as "companySlug",
      s.priority_tier as tier,
      s.crawler_priority_score as "crawlerPriorityScore",
      coalesce(nullif(c.website_url, ''), c.careers_url) as "homepageUrl"
    from app.company c
    join latest_snapshot s on s.company_id = c.id
    where coalesce(nullif(c.website_url, ''), c.careers_url) is not null
      and coalesce(nullif(c.website_url, ''), c.careers_url) not like '%employer.invalid%'
      and s.priority_tier in ('P0', 'P1')
      and ($1::text is null or s.priority_tier = $1)
      and not exists (
        select 1 from app.job_source_candidate jc where jc.company_id = c.id
      )
      and not exists (
        select 1 from app.job_source js where js.company_id = c.id
      )
    order by s.crawler_priority_score desc nulls last, c.name asc
    limit $2
  `,
    [filters.tier ?? null, filters.limit],
  );
  return rows.map((row) => ({
    companyId: row.companyId as string,
    companyName: row.companyName as string,
    companySlug: row.companySlug as string,
    tier: (row.tier as string | null) ?? null,
    crawlerPriorityScore: (row.crawlerPriorityScore as number | null) ?? null,
    homepageUrl: row.homepageUrl as string,
  }));
}

export type DiscoveryCandidateWrite = Readonly<{
  companyId: string;
  url: string;
  channel?: "early_careers" | "professional" | "apprenticeships" | "general" | "other";
  platformHint: string | null;
  status: string;
  discoveryMethod: string;
  evidence: readonly string[];
  notes: string | null;
}>;

export async function upsertDiscoveryCandidate(
  database: TransactionSql,
  write: DiscoveryCandidateWrite,
): Promise<"inserted" | "unchanged"> {
  const rows = await database<{ id: string }[]>`
    insert into app.job_source_candidate (
      company_id, candidate_url, channel, platform_hint, status, discovery_method, evidence, notes
    ) values (
      ${write.companyId}::uuid, ${write.url}, ${write.channel ?? "general"}, ${write.platformHint}, ${write.status},
      ${write.discoveryMethod}, ${write.evidence.join("\n")}, ${write.notes}
    )
    on conflict (company_id, candidate_url) do nothing
    returning id
  `;
  return rows.length === 1 ? "inserted" : "unchanged";
}

export type SponsorEmployerDiscoveryTarget = Readonly<{
  companyId: string;
  companyName: string;
  legalName: string;
  townCity: string | null;
  websiteUrl: string | null;
}>;

export async function countSponsorEmployersMissingWebPresence(
  database: Sql,
  discoveryVersion: string,
  provider: "brave_search" | "dns_https" = "brave_search",
): Promise<number> {
  const rows = await database<{ count: number }[]>`
    select count(distinct c.id)::int as count
    from app.company c
    join app.employer_sponsor_entity se on se.company_id = c.id
      and se.active_in_snapshot = true
      and se.source_snapshot_date = (select max(source_snapshot_date) from app.employer_sponsor_entity)
    where not exists (select 1 from app.job_source_candidate jc where jc.company_id = c.id)
      and not exists (select 1 from app.job_source js where js.company_id = c.id)
      and not exists (
        select 1 from app.employer_web_discovery_attempt wa
        where wa.company_id = c.id and wa.discovery_version = ${discoveryVersion}
          and wa.provider = ${provider} and wa.status in ('matched', 'no_safe_match')
      )
  `;
  return rows[0]?.count ?? 0;
}

export async function listSponsorEmployersMissingWebPresence(
  database: Sql,
  filters: Readonly<{
    limit: number;
    discoveryVersion: string;
    provider?: "brave_search" | "dns_https";
  }>,
): Promise<SponsorEmployerDiscoveryTarget[]> {
  return database<SponsorEmployerDiscoveryTarget[]>`
    with targets as (
      select c.id, c.name, c.website_url,
        min(se.legal_name) as legal_name, min(se.town_city) as town_city,
        coalesce(max(ers.crawler_priority_score), 0) as priority
      from app.company c
      join app.employer_sponsor_entity se on se.company_id = c.id
        and se.active_in_snapshot = true
        and se.source_snapshot_date = (select max(source_snapshot_date) from app.employer_sponsor_entity)
      left join app.employer_research_snapshot ers on ers.company_id = c.id
      where not exists (select 1 from app.job_source_candidate jc where jc.company_id = c.id)
        and not exists (select 1 from app.job_source js where js.company_id = c.id)
        and not exists (
          select 1 from app.employer_web_discovery_attempt wa
          where wa.company_id = c.id and wa.discovery_version = ${filters.discoveryVersion}
            and wa.provider = ${filters.provider ?? "brave_search"}
            and wa.status in ('matched', 'no_safe_match')
        )
      group by c.id, c.name, c.website_url
    )
    select id as "companyId", name as "companyName", legal_name as "legalName",
      town_city as "townCity", website_url as "websiteUrl"
    from targets
    order by priority desc, legal_name asc
    limit ${filters.limit}
  `;
}

export async function fillOfficialCompanyWebsite(
  database: Sql,
  companyId: string,
  websiteUrl: string,
): Promise<"updated" | "unchanged"> {
  const rows = await database<{ id: string }[]>`
    update app.company set website_url = ${websiteUrl}, updated_at = now()
    where id = ${companyId}::uuid and website_url is null
    returning id
  `;
  return rows.length === 1 ? "updated" : "unchanged";
}

export type EmployerWebDiscoveryAttemptWrite = Readonly<{
  companyId: string;
  discoveryVersion: string;
  provider?: "brave_search" | "dns_https";
  status: "matched" | "no_safe_match" | "failed";
  resultCount: number;
  safeCandidateCount: number;
}>;

export async function recordEmployerWebDiscoveryAttempts(
  database: Sql,
  inputs: readonly EmployerWebDiscoveryAttemptWrite[],
): Promise<void> {
  if (inputs.length === 0) return;
  const rows = inputs.map((input) => ({
    checked_at: new Date(),
    company_id: input.companyId,
    discovery_version: input.discoveryVersion,
    provider: input.provider ?? "brave_search",
    result_count: input.resultCount,
    safe_candidate_count: input.safeCandidateCount,
    status: input.status,
  }));
  await database`
    insert into app.employer_web_discovery_attempt ${database(rows)}
    on conflict (company_id, discovery_version, provider) do update set
      status = excluded.status, result_count = excluded.result_count,
      safe_candidate_count = excluded.safe_candidate_count, checked_at = excluded.checked_at
  `;
}

export async function recordEmployerWebDiscoveryAttempt(
  database: Sql,
  input: EmployerWebDiscoveryAttemptWrite,
): Promise<void> {
  await recordEmployerWebDiscoveryAttempts(database, [input]);
}

export type PromotionWrite = Readonly<{
  candidateId: string;
  companyId: string;
  companyName: string;
  candidateUrl: string;
  platform: AtsPlatform;
  automation: SourceAutomationPlan;
  channel: string;
  notes: string;
}>;

export async function promoteCandidateToSource(
  database: TransactionSql,
  write: PromotionWrite,
): Promise<"created" | "activated" | "already_present" | "skipped"> {
  const existing = await findJobSourceByCompanyAndUrl(
    database,
    write.companyId,
    write.candidateUrl,
  );
  if (existing) {
    if (
      existing.status === "active" ||
      existing.status === "archived" ||
      existing.manuallyOverridden
    ) {
      return "already_present";
    }
    const updated = await database<{ id: string }[]>`
      update app.job_source
      set source_type = ${write.automation.sourceType},
          ats_provider = ${platformLabel(write.platform)},
          configuration = ${jsonParameter(database, write.automation.configuration)},
          crawl_endpoint_url = ${write.automation.crawlEndpointUrl},
          status = 'active', automatic_pause_reason = null,
          consecutive_failures = 0, run_requested_at = now(), next_check_at = now(),
          verification_date = now()::date,
          verification_evidence_url = ${write.automation.probe.url},
          notes = ${write.notes.slice(0, 2000)}, updated_at = now()
      where id = ${existing.id}::uuid
      returning id
    `;
    if (updated.length === 0) return "already_present";
    await database`
      update app.job_source_candidate
      set status = 'promoted', verified_at = now(), updated_at = now()
      where id = ${write.candidateId}::uuid
    `;
    return "activated";
  }

  const candidate = await database<{ id: string }[]>`
    select id from app.job_source_candidate
    where id = ${write.candidateId}::uuid
  `;
  if (candidate.length === 0) return "skipped";

  const hostname = new URL(write.candidateUrl).hostname.replace(/^www\./u, "");
  const slug = slugifyEmployerName(`${hostname}-${write.platform}`);
  const sourceType = sourceTypeForPlatform(write.platform);
  const sourceId = await database<{ id: string }[]>`
    insert into app.job_source (
      company_id, slug, name, channel, careers_url, ats_provider, source_type,
      status, configuration, crawl_endpoint_url, notes, verification_date,
      verification_evidence_url, manually_overridden, needs_browser,
      run_requested_at, next_check_at
    ) values (
      ${write.companyId}::uuid, ${slug}, ${`${platformLabel(write.platform)} careers`},
      ${write.channel}, ${write.candidateUrl}, ${platformLabel(write.platform)},
      ${sourceType}, 'active', ${jsonParameter(database, write.automation.configuration)},
      ${write.automation.crawlEndpointUrl}, ${write.notes.slice(0, 2000)}, now()::date,
      ${write.candidateUrl}, false, false, now(), now()
    )
    on conflict (company_id, slug) do nothing
    returning id
  `;
  if (sourceId.length === 0) return "skipped";
  await database`
    update app.job_source_candidate
    set status = 'promoted', verified_at = now(), updated_at = now()
    where id = ${write.candidateId}::uuid
  `;
  return "created";
}
