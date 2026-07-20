export const industries = {
  consulting: "Consulting",
  accounting_professional_services: "Accounting and professional services",
  financial_services: "Financial services",
  technology: "Technology",
  public_sector: "Public sector",
  consumer_retail: "Consumer and retail",
  general_corporate: "General corporate",
  other: "Other",
} as const;

export type Industry = keyof typeof industries;
