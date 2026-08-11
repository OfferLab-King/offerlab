import { describe, expect, it, vi } from "vitest";

import type { JobEnrichmentInput, JobEnrichmentOutput } from "../domain/enrichment-schema";
import { createEnrichmentProvider } from "./enrichment-provider";

const input: JobEnrichmentInput = {
  applicationDeadline: null,
  descriptionText: "We are able to sponsor visas for this role.",
  employmentType: null,
  locationText: "London",
  postedAt: null,
  remoteType: null,
  salaryCurrency: null,
  salaryMax: null,
  salaryMin: null,
  title: "Graduate Analyst",
};

const output: JobEnrichmentOutput = {
  coreSkills: [],
  degreeRequirements: [],
  descriptionSummary: "A graduate analyst role.",
  employmentType: null,
  essentialRequirements: [],
  experienceRequirements: null,
  jobCategory: "investment_banking_asset_management",
  normalizedTitle: "Graduate Analyst",
  preferredRequirements: [],
  remoteType: null,
  responsibilities: [],
  seniorityLevel: "graduate",
  visaSponsorshipEvidence: "We are able to sponsor visas for this role.",
  visaSponsorshipStatus: "confirmed",
};

function providerResponse(value: JobEnrichmentOutput): Response {
  return Response.json({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }],
    usage: { completion_tokens: 20, prompt_tokens: 40 },
  });
}

describe("job enrichment provider", () => {
  it("repairs an ungrounded sponsorship claim and accepts an exact source quote", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        providerResponse({ ...output, visaSponsorshipEvidence: "We sponsor every applicant." }),
      )
      .mockResolvedValueOnce(providerResponse(output));
    const provider = createEnrichmentProvider(
      { apiKey: "test", baseUrl: "https://provider.invalid", model: "test-model" },
      fetchImplementation,
    );
    const result = await provider.enrich(input);
    expect(result.output.visaSponsorshipStatus).toBe("confirmed");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("rejects a sponsorship claim that remains ungrounded after repair", async () => {
    const fabricated = { ...output, visaSponsorshipEvidence: "We sponsor every applicant." };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(providerResponse(fabricated))
      .mockResolvedValueOnce(providerResponse(fabricated));
    const provider = createEnrichmentProvider(
      { apiKey: "test", baseUrl: "https://provider.invalid", model: "test-model" },
      fetchImplementation,
    );
    await expect(provider.enrich(input)).rejects.toThrow("job_enrichment_model_output_invalid");
  });
});
