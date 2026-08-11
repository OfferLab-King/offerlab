import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

/**
 * Bounded identifier-verification probe. For each candidate, issues ONE
 * unauthenticated GET against the employer's official public ATS job-board API
 * (the same endpoint their public careers page uses) with per_page=1, and
 * reports status. This verifies the identifier without crawling anything.
 * Sources are NOT approved by this probe: crawl_allowed stays unknown.
 */

type Candidate = Readonly<{
  company: string;
  sector: string;
  sourceType: "greenhouse" | "lever" | "ashby" | "smartrecruiters";
  identifier: string;
  careersUrl: string;
  apiUrl: string;
}>;

const candidates: readonly Candidate[] = [
  {
    company: "Monzo",
    sector: "technology_it",
    sourceType: "greenhouse",
    identifier: "monzo",
    careersUrl: "https://boards.greenhouse.io/monzo",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/monzo/jobs?per_page=1",
  },
  {
    company: "Deliveroo",
    sector: "consumer_fmcg_retail",
    sourceType: "greenhouse",
    identifier: "deliveroo",
    careersUrl: "https://boards.greenhouse.io/deliveroo",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/deliveroo/jobs?per_page=1",
  },
  {
    company: "Shopify",
    sector: "technology_it",
    sourceType: "greenhouse",
    identifier: "shopify",
    careersUrl: "https://boards.greenhouse.io/shopify",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/shopify/jobs?per_page=1",
  },
  {
    company: "Dropbox",
    sector: "technology_it",
    sourceType: "greenhouse",
    identifier: "dropbox",
    careersUrl: "https://boards.greenhouse.io/dropbox",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/dropbox/jobs?per_page=1",
  },
  {
    company: "Wise",
    sector: "financial_services",
    sourceType: "smartrecruiters",
    identifier: "Wise",
    careersUrl: "https://www.smartrecruiters.com/Wise",
    apiUrl: "https://api.smartrecruiters.com/v1/companies/Wise/postings?limit=1",
  },
  {
    company: "Revolut",
    sector: "financial_services",
    sourceType: "smartrecruiters",
    identifier: "Revolut",
    careersUrl: "https://www.smartrecruiters.com/Revolut",
    apiUrl: "https://api.smartrecruiters.com/v1/companies/Revolut/postings?limit=1",
  },
  {
    company: "Checkout.com",
    sector: "technology_it",
    sourceType: "ashby",
    identifier: "checkoutcom",
    careersUrl: "https://jobs.ashbyhq.com/checkoutcom",
    apiUrl: "https://api.ashbyhq.com/posting-api/job-board/checkoutcom?includeCompensation=true",
  },
  {
    company: "Notion",
    sector: "technology_it",
    sourceType: "ashby",
    identifier: "notion",
    careersUrl: "https://jobs.ashbyhq.com/notion",
    apiUrl: "https://api.ashbyhq.com/posting-api/job-board/notion?includeCompensation=true",
  },
  {
    company: "Slalom",
    sector: "consulting",
    sourceType: "greenhouse",
    identifier: "slalom",
    careersUrl: "https://boards.greenhouse.io/slalom",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/slalom/jobs?per_page=1",
  },
  {
    company: "Thoughtworks",
    sector: "consulting",
    sourceType: "lever",
    identifier: "thoughtworks",
    careersUrl: "https://jobs.lever.co/thoughtworks",
    apiUrl: "https://api.lever.co/v0/postings/thoughtworks?mode=json&limit=1",
  },
  {
    company: "ASOS",
    sector: "consumer_fmcg_retail",
    sourceType: "greenhouse",
    identifier: "asos",
    careersUrl: "https://boards.greenhouse.io/asos",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/asos/jobs?per_page=1",
  },
  {
    company: "Arup",
    sector: "engineering_energy_infrastructure",
    sourceType: "greenhouse",
    identifier: "arup",
    careersUrl: "https://boards.greenhouse.io/arup",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/arup/jobs?per_page=1",
  },
  {
    company: "National Grid",
    sector: "engineering_energy_infrastructure",
    sourceType: "smartrecruiters",
    identifier: "NationalGrid",
    careersUrl: "https://www.smartrecruiters.com/NationalGrid",
    apiUrl: "https://api.smartrecruiters.com/v1/companies/NationalGrid/postings?limit=1",
  },
  {
    company: "Sky",
    sector: "marketing_media_pr",
    sourceType: "greenhouse",
    identifier: "sky",
    careersUrl: "https://boards.greenhouse.io/sky",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/sky/jobs?per_page=1",
  },
  {
    company: "Dentons",
    sector: "law",
    sourceType: "greenhouse",
    identifier: "dentons",
    careersUrl: "https://boards.greenhouse.io/dentons",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/dentons/jobs?per_page=1",
  },
  {
    company: "IQVIA",
    sector: "pharmaceuticals_science",
    sourceType: "smartrecruiters",
    identifier: "IQVIA",
    careersUrl: "https://www.smartrecruiters.com/IQVIA",
    apiUrl: "https://api.smartrecruiters.com/v1/companies/IQVIA/postings?limit=1",
  },
  {
    company: "Save the Children",
    sector: "public_sector_charity",
    sourceType: "smartrecruiters",
    identifier: "Save the Children",
    careersUrl: "https://www.smartrecruiters.com/Save-the-Children",
    apiUrl: "https://api.smartrecruiters.com/v1/companies/Save%20the%20Children/postings?limit=1",
  },
  {
    company: "PageGroup",
    sector: "sales_recruitment_commercial",
    sourceType: "smartrecruiters",
    identifier: "PageGroup",
    careersUrl: "https://www.smartrecruiters.com/PageGroup",
    apiUrl: "https://api.smartrecruiters.com/v1/companies/PageGroup/postings?limit=1",
  },
  {
    company: "Skyscanner",
    sector: "technology_it",
    sourceType: "lever",
    identifier: "skyscanner",
    careersUrl: "https://jobs.lever.co/skyscanner",
    apiUrl: "https://api.lever.co/v0/postings/skyscanner?mode=json",
  },
  {
    company: "Bumble",
    sector: "technology_it",
    sourceType: "greenhouse",
    identifier: "bumble",
    careersUrl: "https://boards.greenhouse.io/bumble",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/bumble/jobs?per_page=1",
  },
  {
    company: "Duolingo",
    sector: "technology_it",
    sourceType: "greenhouse",
    identifier: "duolingo",
    careersUrl: "https://boards.greenhouse.io/duolingo",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/duolingo/jobs?per_page=1",
  },
  {
    company: "Instacart",
    sector: "consumer_fmcg_retail",
    sourceType: "greenhouse",
    identifier: "instacart",
    careersUrl: "https://boards.greenhouse.io/instacart",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/instacart/jobs?per_page=1",
  },
  {
    company: "Robinhood",
    sector: "financial_services",
    sourceType: "greenhouse",
    identifier: "robinhood",
    careersUrl: "https://boards.greenhouse.io/robinhood",
    apiUrl: "https://boards-api.greenhouse.io/v1/boards/robinhood/jobs?per_page=1",
  },
];

const results: string[] = [];
for (const candidate of candidates) {
  try {
    const response = await fetch(candidate.apiUrl, {
      headers: {
        accept: "application/json",
        "user-agent": "OfferLabSourceVerificationProbe/1.0 (single bounded GET, no crawling)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    results.push(
      `${response.status} ${candidate.sourceType.padEnd(18)} ${candidate.company.padEnd(24)} ${candidate.identifier}`,
    );
  } catch (error) {
    results.push(
      `ERR ${candidate.sourceType.padEnd(18)} ${candidate.company.padEnd(24)} ${candidate.identifier} ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}
process.stdout.write(`${results.join("\n")}\n`);
