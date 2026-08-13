/**
 * Canonical employer-industry taxonomy (preparation contract).
 *
 * Phase D of the employer-universe directive separates employer industry from
 * job function and career level. These keys are the typed contract for that
 * migration; they are not yet applied to app.company, app.job or the public
 * filters. The Top 1,000 workbook sector values map onto these keys.
 */

export const employerIndustries = [
  "financial_services",
  "professional_services_consulting",
  "technology_software",
  "engineering_manufacturing",
  "energy_utilities_infrastructure",
  "consumer_retail_fmcg",
  "healthcare_pharma_life_sciences",
  "media_telecom_entertainment",
  "transport_logistics_travel",
  "real_estate_construction",
  "legal_services",
  "public_sector_government",
  "education_research",
  "charity_nonprofit",
  "hospitality_leisure",
  "other",
] as const;

export type EmployerIndustryKey = (typeof employerIndustries)[number];

export const employerIndustrySubindustries: Readonly<
  Record<EmployerIndustryKey, readonly string[]>
> = {
  financial_services: [
    "banking",
    "investment_banking",
    "asset_management",
    "wealth_management",
    "insurance",
    "fintech",
    "payments",
    "private_markets",
    "market_infrastructure",
    "lending_credit",
  ],
  professional_services_consulting: [
    "management_consulting",
    "accounting_audit",
    "tax_advisory",
    "strategy",
    "outsourcing",
    "other_professional_services",
  ],
  technology_software: [
    "software",
    "it_services",
    "internet_platforms",
    "cloud_infrastructure",
    "cybersecurity",
    "other_technology",
  ],
  engineering_manufacturing: [
    "aerospace_defence",
    "automotive",
    "industrial_engineering",
    "electronics",
    "advanced_manufacturing",
    "other_engineering",
  ],
  energy_utilities_infrastructure: [
    "oil_gas",
    "electricity_generation",
    "renewables",
    "utilities_networks",
    "infrastructure",
    "other_energy",
  ],
  consumer_retail_fmcg: [
    "retail",
    "consumer_goods",
    "food_beverage",
    "fashion_apparel",
    "ecommerce",
    "other_consumer",
  ],
  healthcare_pharma_life_sciences: [
    "pharmaceuticals",
    "medical_devices",
    "healthcare_provision",
    "life_sciences",
    "biotech",
    "other_healthcare",
  ],
  media_telecom_entertainment: [
    "broadcasting",
    "publishing",
    "telecoms",
    "entertainment",
    "gaming",
    "advertising",
    "other_media",
  ],
  transport_logistics_travel: [
    "airlines_aviation",
    "rail",
    "shipping",
    "logistics",
    "travel_tourism",
    "other_transport",
  ],
  real_estate_construction: [
    "real_estate",
    "construction",
    "property_development",
    "facilities",
    "other_real_estate",
  ],
  legal_services: ["law_firms", "legal_support", "other_legal"],
  public_sector_government: [
    "central_government",
    "local_government",
    "defence_public",
    "regulators",
    "other_public_sector",
  ],
  education_research: [
    "universities",
    "schools",
    "research_institutes",
    "edtech",
    "other_education",
  ],
  charity_nonprofit: ["charities", "foundations", "social_enterprise", "other_charity"],
  hospitality_leisure: [
    "hotels",
    "restaurants",
    "leisure_attractions",
    "events",
    "other_hospitality",
  ],
  other: [],
};

export const employerIndustryLabels: Readonly<Record<EmployerIndustryKey, string>> = {
  financial_services: "Financial Services",
  professional_services_consulting: "Professional Services & Consulting",
  technology_software: "Technology & Software",
  engineering_manufacturing: "Engineering & Manufacturing",
  energy_utilities_infrastructure: "Energy, Utilities & Infrastructure",
  consumer_retail_fmcg: "Consumer, Retail & FMCG",
  healthcare_pharma_life_sciences: "Healthcare, Pharma & Life Sciences",
  media_telecom_entertainment: "Media, Telecom & Entertainment",
  transport_logistics_travel: "Transport, Logistics & Travel",
  real_estate_construction: "Real Estate & Construction",
  legal_services: "Legal Services",
  public_sector_government: "Public Sector & Government",
  education_research: "Education & Research",
  charity_nonprofit: "Charity & Non-profit",
  hospitality_leisure: "Hospitality & Leisure",
  other: "Other",
};

/** Deterministic mapping from the Top 1,000 workbook sector values. */
export function employerIndustryFromResearchSector(sector: string | null): EmployerIndustryKey {
  const normalized = (sector ?? "").toLowerCase();
  if (normalized.includes("financial")) return "financial_services";
  if (normalized.includes("professional") || normalized.includes("consulting"))
    return "professional_services_consulting";
  if (normalized.includes("technology")) return "technology_software";
  if (normalized.includes("industrial") || normalized.includes("engineering"))
    return "engineering_manufacturing";
  if (normalized.includes("energy") || normalized.includes("utility"))
    return "energy_utilities_infrastructure";
  if (normalized.includes("consumer")) return "consumer_retail_fmcg";
  if (
    normalized.includes("healthcare") ||
    normalized.includes("life sciences") ||
    normalized.includes("pharma")
  )
    return "healthcare_pharma_life_sciences";
  if (normalized.includes("media") || normalized.includes("entertainment"))
    return "media_telecom_entertainment";
  if (
    normalized.includes("travel") ||
    normalized.includes("logistics") ||
    normalized.includes("transport")
  )
    return "transport_logistics_travel";
  if (normalized.includes("real estate")) return "real_estate_construction";
  if (normalized.includes("legal")) return "legal_services";
  if (normalized.includes("public sector") || normalized.includes("government"))
    return "public_sector_government";
  if (normalized.includes("education") || normalized.includes("research"))
    return "education_research";
  if (
    normalized.includes("charity") ||
    normalized.includes("nonprofit") ||
    normalized.includes("non-profit")
  )
    return "charity_nonprofit";
  if (normalized.includes("hospitality") || normalized.includes("leisure"))
    return "hospitality_leisure";
  return "other";
}
