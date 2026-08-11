import { describe, expect, it } from "vitest";

import {
  isJobCatalogEnabled,
  readCrawlerConfiguration,
  readEnrichmentConfiguration,
} from "./config";

describe("job catalog configuration", () => {
  it("keeps crawling and hosted enrichment disabled by default", () => {
    const crawler = readCrawlerConfiguration({});
    const enrichment = readEnrichmentConfiguration({});
    expect(crawler.catalogEnabled).toBe(false);
    expect(crawler.llmEnabled).toBe(false);
    expect(enrichment.catalogEnabled).toBe(false);
    expect(enrichment.llmEnabled).toBe(false);
    expect(isJobCatalogEnabled({})).toBe(false);
  });

  it("requires explicit true flags to enable the catalog and model", () => {
    const environment = { JOB_CATALOG_ENABLED: "true", JOB_LLM_ENABLED: "true" };
    expect(readCrawlerConfiguration(environment).catalogEnabled).toBe(true);
    expect(readEnrichmentConfiguration(environment).llmEnabled).toBe(true);
    expect(isJobCatalogEnabled(environment)).toBe(true);
  });
});
