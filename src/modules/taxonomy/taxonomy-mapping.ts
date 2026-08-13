/**
 * Deterministic mappings between the legacy mixed sector/subsector model and
 * the new employer-industry / job-function / career-level dimensions (Phase D).
 *
 * Rules:
 * - Job function is derived from the job's own classification (legacy
 *   subsector or title rules), never from employer industry.
 * - Career level is classification information, never a publication gate.
 * - All mappings are conservative: unknown legacy values produce null/unknown
 *   rather than a guessed key.
 */

import type { JobFunctionKey } from "./job-function";
import type { CareerLevelKey } from "./career-level";

const LEGACY_SUBSECTOR_TO_FUNCTION: Readonly<Record<string, JobFunctionKey>> = {
  accounting_audit_tax: "finance_accounting",
  insurance_pensions: "finance_accounting",
  retail_corporate_banking: "finance_accounting",
  asset_investment_management: "asset_wealth_investment_management",
  investment_banking: "investment_banking_corporate_finance",
  private_equity: "asset_wealth_investment_management",
  trading: "markets_trading_research",
  consulting_project_management: "consulting_strategy",
  financial_consulting: "consulting_strategy",
  management_consulting: "consulting_strategy",
  strategy_consulting: "consulting_strategy",
  commercial_law: "legal",
  criminal_law: "legal",
  business_management: "project_programme_management",
  entrepreneurship: "other",
  human_resources: "human_resources_recruitment",
  operations_communications: "marketing_communications",
  journalism_publishing: "marketing_communications",
  marketing: "marketing_communications",
  media_film_tv: "marketing_communications",
  public_relations: "marketing_communications",
  consumer_goods_fmcg: "marketing_communications",
  retail_fashion: "sales_business_development",
  supply_chain_logistics: "operations_supply_chain",
  architecture: "engineering",
  engineering: "engineering",
  energy: "engineering",
  property_construction: "engineering",
  pharmaceuticals: "science_research",
  science_research: "science_research",
  charity_social_enterprise: "public_policy_government",
  education_teaching: "other",
  public_sector_government: "public_policy_government",
  recruitment: "human_resources_recruitment",
  sales_commercial: "sales_business_development",
  cyber_security: "cybersecurity_it",
  data_science_analytics: "data_analytics_ai",
  it_infrastructure: "cybersecurity_it",
  software_development: "software_engineering",
  other: "other",
};

const LEGACY_SENIORITY_TO_LEVEL: Readonly<Record<string, CareerLevelKey>> = {
  intern: "intern",
  graduate: "graduate",
  entry: "entry_level",
  junior: "junior",
  mid: "experienced",
  senior: "experienced",
  lead: "manager",
  manager: "manager",
  other: "unknown",
  unknown: "unknown",
};

const OPPORTUNITY_TO_LEVEL: Readonly<Record<string, CareerLevelKey>> = {
  graduate_scheme: "graduate",
  graduate_job: "graduate",
  internship: "intern",
  industrial_placement: "student",
  work_experience: "student",
  degree_apprenticeship: "school_leaver",
  apprenticeship: "school_leaver",
  immediate_start: "entry_level",
  knowledge_transfer_partnership: "student",
  training_contract: "graduate",
  vacation_scheme: "student",
  volunteering: "student",
  entry_level: "entry_level",
  junior: "junior",
  postgraduate_opportunity: "graduate",
  other_early_career: "entry_level",
};

/** Maps a legacy job subsector to the canonical job function. */
export function jobFunctionFromLegacySubsector(
  subsectorKey: string | null | undefined,
): JobFunctionKey | null {
  if (!subsectorKey) return null;
  return LEGACY_SUBSECTOR_TO_FUNCTION[subsectorKey] ?? null;
}

/** Derives career level from the job's opportunity type and seniority. */
export function careerLevelFromOpportunityAndSeniority(
  opportunityType: string | null | undefined,
  seniorityLevel: string | null | undefined,
): CareerLevelKey {
  if (opportunityType) {
    const fromOpportunity = OPPORTUNITY_TO_LEVEL[opportunityType];
    if (fromOpportunity) return fromOpportunity;
  }
  if (seniorityLevel) {
    const fromSeniority = LEGACY_SENIORITY_TO_LEVEL[seniorityLevel];
    if (fromSeniority) return fromSeniority;
  }
  return "unknown";
}

const LEGACY_DIRECTORY_SECTOR_TO_INDUSTRY: Readonly<Record<string, string>> = {
  consulting: "professional_services_consulting",
  consumer_fmcg_retail: "consumer_retail_fmcg",
  engineering_energy_infrastructure: "engineering_manufacturing",
  financial_services: "financial_services",
  investment_banking_asset_management: "financial_services",
  law: "legal_services",
  management_operations: "other",
  marketing_media_pr: "media_telecom_entertainment",
  pharmaceuticals_science: "healthcare_pharma_life_sciences",
  public_sector_charity: "public_sector_government",
  sales_recruitment_commercial: "other",
  technology_it: "technology_software",
};

/** Maps a legacy directory sector key to an employer industry key. */
export function employerIndustryFromDirectorySector(
  directorySectorKey: string | null | undefined,
): string | null {
  if (!directorySectorKey) return null;
  return LEGACY_DIRECTORY_SECTOR_TO_INDUSTRY[directorySectorKey] ?? null;
}
