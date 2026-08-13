/**
 * Canonical job-function taxonomy (preparation contract).
 *
 * Phase D of the employer-universe directive separates job function from
 * employer industry and career level. A bank's software engineer is
 * financial_services (employer industry) + software_engineering (job
 * function). These keys are the typed contract for that migration; they are
 * not yet applied to app.job.
 */

export const jobFunctions = [
  "finance_accounting",
  "investment_banking_corporate_finance",
  "markets_trading_research",
  "asset_wealth_investment_management",
  "consulting_strategy",
  "software_engineering",
  "data_analytics_ai",
  "product_management",
  "cybersecurity_it",
  "engineering",
  "science_research",
  "operations_supply_chain",
  "project_programme_management",
  "sales_business_development",
  "marketing_communications",
  "human_resources_recruitment",
  "legal",
  "risk_compliance_controls",
  "customer_service",
  "design_ux",
  "healthcare_clinical",
  "public_policy_government",
  "administration",
  "other",
] as const;

export type JobFunctionKey = (typeof jobFunctions)[number];

export const jobFunctionLabels: Readonly<Record<JobFunctionKey, string>> = {
  finance_accounting: "Finance & Accounting",
  investment_banking_corporate_finance: "Investment Banking & Corporate Finance",
  markets_trading_research: "Markets, Trading & Research",
  asset_wealth_investment_management: "Asset & Wealth Management",
  consulting_strategy: "Consulting & Strategy",
  software_engineering: "Software Engineering",
  data_analytics_ai: "Data, Analytics & AI",
  product_management: "Product Management",
  cybersecurity_it: "Cybersecurity & IT",
  engineering: "Engineering",
  science_research: "Science & Research",
  operations_supply_chain: "Operations & Supply Chain",
  project_programme_management: "Project & Programme Management",
  sales_business_development: "Sales & Business Development",
  marketing_communications: "Marketing & Communications",
  human_resources_recruitment: "Human Resources & Recruitment",
  legal: "Legal",
  risk_compliance_controls: "Risk, Compliance & Controls",
  customer_service: "Customer Service",
  design_ux: "Design & UX",
  healthcare_clinical: "Healthcare (Clinical)",
  public_policy_government: "Public Policy & Government",
  administration: "Administration",
  other: "Other",
};

export const jobSubfunctionFamilies: Readonly<Record<JobFunctionKey, readonly string[]>> = {
  finance_accounting: [
    "financial_control",
    "tax",
    "audit",
    "treasury",
    "financial_planning",
    "other_finance",
  ],
  investment_banking_corporate_finance: [
    "ibd",
    "corporate_finance",
    "m_and_a",
    "capital_markets",
    "other_ib",
  ],
  markets_trading_research: [
    "sales_and_trading",
    "research",
    "quant",
    "structuring",
    "other_markets",
  ],
  asset_wealth_investment_management: [
    "asset_management",
    "wealth_management",
    "private_markets",
    "other_am",
  ],
  consulting_strategy: ["management_consulting", "strategy", "implementation", "other_consulting"],
  software_engineering: [
    "backend",
    "frontend",
    "fullstack",
    "mobile",
    "devops",
    "platform",
    "data_engineering",
    "other_software",
  ],
  data_analytics_ai: [
    "analytics",
    "machine_learning",
    "data_science",
    "business_intelligence",
    "other_data",
  ],
  product_management: [
    "product_management",
    "programme_management",
    "product_ops",
    "other_product",
  ],
  cybersecurity_it: [
    "security_engineering",
    "governance",
    "it_support",
    "cloud_platform",
    "other_it",
  ],
  engineering: ["mechanical", "electrical", "civil", "chemical", "aerospace", "other_engineering"],
  science_research: ["life_sciences", "physical_sciences", "clinical_research", "other_science"],
  operations_supply_chain: ["operations", "procurement", "logistics", "facilities", "other_ops"],
  project_programme_management: ["project_management", "programme_management", "agile", "other_pm"],
  sales_business_development: [
    "sales",
    "business_development",
    "account_management",
    "other_sales",
  ],
  marketing_communications: ["marketing", "communications", "brand", "social", "other_marketing"],
  human_resources_recruitment: [
    "hr_business_partnering",
    "recruitment",
    "learning_development",
    "people_ops",
    "other_hr",
  ],
  legal: ["legal_counsel", "compliance_legal", "paralegal", "other_legal"],
  risk_compliance_controls: [
    "risk",
    "compliance",
    "financial_crime",
    "internal_audit",
    "other_risk",
  ],
  customer_service: ["customer_support", "client_service", "operations_customer", "other_customer"],
  design_ux: ["ux_design", "ui_design", "research_design", "other_design"],
  healthcare_clinical: ["clinical", "nursing", "pharmacy", "other_clinical"],
  public_policy_government: ["policy", "public_affairs", "government_relations", "other_policy"],
  administration: ["executive_support", "office_management", "other_admin"],
  other: [],
};
