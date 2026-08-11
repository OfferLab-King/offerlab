export const jobSectors = [
  {
    key: "consulting",
    displayName: "Consulting",
    description:
      "Advisory and transformation work helping organisations solve problems and improve performance.",
  },
  {
    key: "consumer_fmcg_retail",
    displayName: "Consumer, FMCG & Retail",
    description:
      "Brands, fast-moving consumer goods, retail operations and the supply chains behind them.",
  },
  {
    key: "engineering_energy_infrastructure",
    displayName: "Engineering, Energy & Infrastructure",
    description:
      "Design, build and operate the physical world: engineering, construction, energy and property.",
  },
  {
    key: "financial_services",
    displayName: "Financial Services",
    description:
      "Banking, insurance and professional financial operations serving businesses and individuals.",
  },
  {
    key: "investment_banking_asset_management",
    displayName: "Investment Banking & Asset Management",
    description:
      "Capital markets, advisory, investing and trading careers in banking and investment firms.",
  },
  {
    key: "law",
    displayName: "Law",
    description: "Legal practice, from commercial transactions to criminal and public law.",
  },
  {
    key: "management_operations",
    displayName: "Management & Operations",
    description: "Business leadership, operations, people and process roles inside organisations.",
  },
  {
    key: "marketing_media_pr",
    displayName: "Marketing, Media & PR",
    description: "Communications, brand, journalism, media production and public relations.",
  },
  {
    key: "pharmaceuticals_science",
    displayName: "Pharmaceuticals & Science",
    description: "Research, development and production in life sciences and applied science.",
  },
  {
    key: "public_sector_charity",
    displayName: "Public Sector & Charity",
    description: "Government, public services, education and charitable organisations.",
  },
  {
    key: "sales_recruitment_commercial",
    displayName: "Sales, Recruitment & Commercial",
    description:
      "Revenue-facing and people-facing commercial roles: sales, recruitment and account management.",
  },
  {
    key: "technology_it",
    displayName: "Technology & IT Infrastructure",
    description:
      "Software, data, cyber security and the technology infrastructure that runs organisations.",
  },
] as const;

export type JobSectorKey = (typeof jobSectors)[number]["key"];

export const jobSectorKeys = jobSectors.map((sector) => sector.key) as readonly JobSectorKey[];

export function jobSectorLabel(key: string | null | undefined): string | null {
  return jobSectors.find((sector) => sector.key === key)?.displayName ?? null;
}

export function parseJobSectorKey(value: string | null | undefined): JobSectorKey | null {
  if (value && (jobSectorKeys as readonly string[]).includes(value)) return value as JobSectorKey;
  return null;
}

export const jobSubsectors = [
  {
    key: "accounting_audit_tax",
    displayName: "Accounting, Audit & Tax",
    sectorKey: "financial_services",
  },
  {
    key: "insurance_pensions",
    displayName: "Insurance & Pensions",
    sectorKey: "financial_services",
  },
  {
    key: "retail_corporate_banking",
    displayName: "Retail & Corporate Banking",
    sectorKey: "financial_services",
  },
  {
    key: "asset_investment_management",
    displayName: "Asset & Investment Management",
    sectorKey: "investment_banking_asset_management",
  },
  {
    key: "investment_banking",
    displayName: "Investment Banking",
    sectorKey: "investment_banking_asset_management",
  },
  {
    key: "private_equity",
    displayName: "Private Equity",
    sectorKey: "investment_banking_asset_management",
  },
  { key: "trading", displayName: "Trading", sectorKey: "investment_banking_asset_management" },
  {
    key: "consulting_project_management",
    displayName: "Consulting & Project Management",
    sectorKey: "consulting",
  },
  { key: "financial_consulting", displayName: "Financial Consulting", sectorKey: "consulting" },
  { key: "management_consulting", displayName: "Management Consulting", sectorKey: "consulting" },
  { key: "strategy_consulting", displayName: "Strategy Consulting", sectorKey: "consulting" },
  { key: "commercial_law", displayName: "Commercial Law", sectorKey: "law" },
  { key: "criminal_law", displayName: "Criminal Law", sectorKey: "law" },
  {
    key: "business_management",
    displayName: "Business Management",
    sectorKey: "management_operations",
  },
  { key: "entrepreneurship", displayName: "Entrepreneurship", sectorKey: "management_operations" },
  { key: "human_resources", displayName: "Human Resources", sectorKey: "management_operations" },
  {
    key: "operations_communications",
    displayName: "Operations & Communications",
    sectorKey: "management_operations",
  },
  {
    key: "consumer_goods_fmcg",
    displayName: "Consumer Goods & FMCG",
    sectorKey: "consumer_fmcg_retail",
  },
  { key: "retail_fashion", displayName: "Retail & Fashion", sectorKey: "consumer_fmcg_retail" },
  {
    key: "supply_chain_logistics",
    displayName: "Supply Chain & Logistics",
    sectorKey: "consumer_fmcg_retail",
  },
  {
    key: "architecture",
    displayName: "Architecture",
    sectorKey: "engineering_energy_infrastructure",
  },
  {
    key: "engineering",
    displayName: "Engineering",
    sectorKey: "engineering_energy_infrastructure",
  },
  { key: "energy", displayName: "Energy", sectorKey: "engineering_energy_infrastructure" },
  {
    key: "property_construction",
    displayName: "Property & Construction",
    sectorKey: "engineering_energy_infrastructure",
  },
  {
    key: "journalism_publishing",
    displayName: "Journalism & Publishing",
    sectorKey: "marketing_media_pr",
  },
  { key: "marketing", displayName: "Marketing", sectorKey: "marketing_media_pr" },
  { key: "media_film_tv", displayName: "Media, Film & TV", sectorKey: "marketing_media_pr" },
  { key: "public_relations", displayName: "Public Relations", sectorKey: "marketing_media_pr" },
  { key: "pharmaceuticals", displayName: "Pharmaceuticals", sectorKey: "pharmaceuticals_science" },
  {
    key: "science_research",
    displayName: "Science & Research",
    sectorKey: "pharmaceuticals_science",
  },
  {
    key: "charity_social_enterprise",
    displayName: "Charity & Social Enterprise",
    sectorKey: "public_sector_charity",
  },
  {
    key: "education_teaching",
    displayName: "Education & Teaching",
    sectorKey: "public_sector_charity",
  },
  {
    key: "public_sector_government",
    displayName: "Public Sector & Government",
    sectorKey: "public_sector_charity",
  },
  { key: "recruitment", displayName: "Recruitment", sectorKey: "sales_recruitment_commercial" },
  {
    key: "sales_commercial",
    displayName: "Sales & Commercial",
    sectorKey: "sales_recruitment_commercial",
  },
  { key: "cyber_security", displayName: "Cyber Security", sectorKey: "technology_it" },
  {
    key: "data_science_analytics",
    displayName: "Data Science & Analytics",
    sectorKey: "technology_it",
  },
  { key: "it_infrastructure", displayName: "IT Infrastructure", sectorKey: "technology_it" },
  { key: "software_development", displayName: "Software Development", sectorKey: "technology_it" },
  { key: "other", displayName: "Other", sectorKey: null },
] as const;

export type JobSubsectorKey = (typeof jobSubsectors)[number]["key"];

export const jobSubsectorKeys = jobSubsectors.map(
  (subsector) => subsector.key,
) as readonly JobSubsectorKey[];

export function jobSubsectorLabel(key: string | null | undefined): string | null {
  return jobSubsectors.find((subsector) => subsector.key === key)?.displayName ?? null;
}

export function parseJobSubsectorKey(value: string | null | undefined): JobSubsectorKey | null {
  if (value && (jobSubsectorKeys as readonly string[]).includes(value)) {
    return value as JobSubsectorKey;
  }
  return null;
}

export function subsectorSectorKey(subsectorKey: JobSubsectorKey): JobSectorKey | null {
  return jobSubsectors.find((subsector) => subsector.key === subsectorKey)?.sectorKey ?? null;
}

export function subsectorsForSector(sectorKey: JobSectorKey): readonly JobSubsectorKey[] {
  return jobSubsectors
    .filter((subsector) => subsector.sectorKey === sectorKey)
    .map((subsector) => subsector.key);
}

export const opportunityTypes = [
  "graduate_job",
  "graduate_scheme",
  "internship",
  "industrial_placement",
  "work_experience",
  "degree_apprenticeship",
  "apprenticeship",
  "immediate_start",
  "knowledge_transfer_partnership",
  "training_contract",
  "vacation_scheme",
  "volunteering",
  "entry_level",
  "junior",
  "postgraduate_opportunity",
  "other_early_career",
  "unknown",
] as const;

export type OpportunityType = (typeof opportunityTypes)[number];

export const opportunityTypeLabels: Readonly<Record<OpportunityType, string>> = {
  graduate_job: "Graduate job",
  graduate_scheme: "Graduate scheme / programme",
  internship: "Internship",
  industrial_placement: "Industrial placement",
  work_experience: "Work experience",
  degree_apprenticeship: "Degree apprenticeship",
  apprenticeship: "Apprenticeship",
  immediate_start: "Immediate start",
  knowledge_transfer_partnership: "Knowledge transfer partnership",
  training_contract: "Training contract",
  vacation_scheme: "Vacation scheme",
  volunteering: "Volunteering",
  entry_level: "Entry-level",
  junior: "Junior",
  postgraduate_opportunity: "Postgraduate opportunity",
  other_early_career: "Other early-career",
  unknown: "Not specified",
};

export function parseOpportunityType(value: string | null | undefined): OpportunityType {
  if (value && (opportunityTypes as readonly string[]).includes(value)) {
    return value as OpportunityType;
  }
  return "unknown";
}

export const employmentTypes = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "graduate_programme",
  "other",
  "unknown",
] as const;

export type EmploymentType = (typeof employmentTypes)[number];

export const employmentTypeLabels: Readonly<Record<EmploymentType, string>> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
  graduate_programme: "Graduate programme",
  other: "Other",
  unknown: "Not specified",
};

export function parseEmploymentType(value: string | null | undefined): EmploymentType | null {
  if (value && (employmentTypes as readonly string[]).includes(value))
    return value as EmploymentType;
  return null;
}

export const seniorityLevels = [
  "intern",
  "graduate",
  "entry",
  "junior",
  "mid",
  "senior",
  "lead",
  "manager",
  "other",
  "unknown",
] as const;

export type SeniorityLevel = (typeof seniorityLevels)[number];

export function parseSeniorityLevel(value: string | null | undefined): SeniorityLevel | null {
  if (value && (seniorityLevels as readonly string[]).includes(value)) {
    return value as SeniorityLevel;
  }
  return null;
}

export const remoteTypes = ["remote", "hybrid", "on_site", "unknown"] as const;

export type RemoteType = (typeof remoteTypes)[number];

export const remoteTypeLabels: Readonly<Record<RemoteType, string>> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On site",
  unknown: "Not specified",
};

export function parseRemoteType(value: string | null | undefined): RemoteType | null {
  if (value && (remoteTypes as readonly string[]).includes(value)) return value as RemoteType;
  return null;
}

export const visaSponsorshipStatuses = [
  "confirmed",
  "likely",
  "unlikely",
  "not_offered",
  "unknown",
] as const;

export type VisaSponsorshipStatus = (typeof visaSponsorshipStatuses)[number];

export const visaSponsorshipLabels: Readonly<Record<VisaSponsorshipStatus, string>> = {
  confirmed: "Visa sponsorship confirmed",
  likely: "Visa sponsorship likely",
  unlikely: "Visa sponsorship unlikely",
  not_offered: "Visa sponsorship not offered",
  unknown: "Visa sponsorship not specified",
};

export function parseVisaSponsorshipStatus(
  value: string | null | undefined,
): VisaSponsorshipStatus {
  if (value && (visaSponsorshipStatuses as readonly string[]).includes(value)) {
    return value as VisaSponsorshipStatus;
  }
  return "unknown";
}
