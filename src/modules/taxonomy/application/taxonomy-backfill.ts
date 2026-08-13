import type { TransactionSql } from "postgres";

import { employerIndustryFromResearchSector } from "../employer-industry";
import {
  careerLevelFromOpportunityAndSeniority,
  employerIndustryFromDirectorySector,
  jobFunctionFromLegacySubsector,
} from "../taxonomy-mapping";

export type TaxonomyBackfillReport = Readonly<{
  mode: "dry_run" | "applied";
  companiesPlanned: number;
  companiesApplied: number;
  jobFunctionsPlanned: number;
  jobFunctionsApplied: number;
  careerLevelsPlanned: number;
  careerLevelsApplied: number;
}>;

/**
 * Fills the Phase D taxonomy dimensions from legacy and research evidence.
 * Non-destructive: only NULL cells are written; re-running is idempotent.
 * Job function derives from the job's own legacy classification, never from
 * employer industry.
 */
export async function runTaxonomyBackfill(
  database: TransactionSql,
  apply: boolean,
): Promise<TaxonomyBackfillReport> {
  const companies = await database<
    {
      id: string;
      employerIndustryKey: string | null;
      directorySectorKey: string | null;
      sector: string | null;
    }[]
  >`
    with latest_snapshot as (
      select distinct on (company_id) company_id, sector
      from app.employer_research_snapshot
      where company_id is not null
      order by company_id, research_date desc, dataset_version desc
    )
    select c.id, c.employer_industry_key as "employerIndustryKey",
      c.directory_sector_key as "directorySectorKey", s.sector as sector
    from app.company c
    left join latest_snapshot s on s.company_id = c.id
    where c.employer_industry_key is null
  `;

  let companiesPlanned = 0;
  let companiesApplied = 0;
  for (const company of companies) {
    const fromResearch = employerIndustryFromResearchSector(company.sector);
    const industry =
      fromResearch === "other"
        ? (employerIndustryFromDirectorySector(company.directorySectorKey) ?? null)
        : fromResearch;
    if (!industry) continue;
    companiesPlanned += 1;
    if (!apply) continue;
    const rows = await database`
      update app.company
      set employer_industry_key = ${industry}, updated_at = now()
      where id = ${company.id}::uuid and employer_industry_key is null
      returning id
    `;
    if (rows.length === 1) companiesApplied += 1;
  }

  const jobs = await database<
    {
      id: string;
      subsectorKey: string | null;
      opportunityType: string;
      seniorityLevel: string | null;
      jobFunctionKey: string | null;
      careerLevelKey: string | null;
    }[]
  >`
    select id, subsector_key as "subsectorKey", opportunity_type as "opportunityType",
      seniority_level as "seniorityLevel",
      job_function_key as "jobFunctionKey", career_level_key as "careerLevelKey"
    from app.job
    where job_function_key is null or career_level_key is null
  `;

  let jobFunctionsPlanned = 0;
  let jobFunctionsApplied = 0;
  let careerLevelsPlanned = 0;
  let careerLevelsApplied = 0;
  for (const job of jobs) {
    const functionKey = job.jobFunctionKey ?? jobFunctionFromLegacySubsector(job.subsectorKey);
    const levelKey =
      job.careerLevelKey ??
      careerLevelFromOpportunityAndSeniority(job.opportunityType, job.seniorityLevel);
    if (functionKey && !job.jobFunctionKey) jobFunctionsPlanned += 1;
    if (job.careerLevelKey === null) careerLevelsPlanned += 1;
    if (!apply) continue;
    if (functionKey && !job.jobFunctionKey) {
      const rows = await database`
        update app.job set job_function_key = ${functionKey}, updated_at = now()
        where id = ${job.id}::uuid and job_function_key is null
        returning id
      `;
      if (rows.length === 1) jobFunctionsApplied += 1;
    }
    if (job.careerLevelKey === null) {
      const rows = await database`
        update app.job set career_level_key = ${levelKey}, updated_at = now()
        where id = ${job.id}::uuid and career_level_key is null
        returning id
      `;
      if (rows.length === 1) careerLevelsApplied += 1;
    }
  }

  return {
    mode: apply ? "applied" : "dry_run",
    companiesPlanned,
    companiesApplied,
    jobFunctionsPlanned,
    jobFunctionsApplied,
    careerLevelsPlanned,
    careerLevelsApplied,
  };
}

export function formatTaxonomyBackfillReport(report: TaxonomyBackfillReport): string {
  return (
    [
      `\n== Taxonomy dimension backfill ==`,
      `mode: ${report.mode === "applied" ? "applied" : "dry run (no writes)"}`,
      `companies: ${report.companiesPlanned} planned / ${report.companiesApplied} applied`,
      `job functions: ${report.jobFunctionsPlanned} planned / ${report.jobFunctionsApplied} applied`,
      `career levels: ${report.careerLevelsPlanned} planned / ${report.careerLevelsApplied} applied`,
      report.mode === "dry_run" ? "Dry run - no writes. Re-run with --confirm to apply." : "",
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );
}
