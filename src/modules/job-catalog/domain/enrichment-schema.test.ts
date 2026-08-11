import { describe, expect, it } from "vitest";

import {
  buildEnrichmentSystemPrompt,
  buildEnrichmentUserPrompt,
  jobEnrichmentOutputSchema,
  JOB_ENRICHMENT_PROMPT_VERSION,
  validateEnrichmentOutput,
  type JobEnrichmentOutput,
} from "./enrichment-schema";

const validOutput: JobEnrichmentOutput = {
  coreSkills: ["SQL", "Excel"],
  degreeRequirements: ["2:1 in any discipline"],
  descriptionSummary: "A graduate analyst role supporting the corporate banking team.",
  employmentType: "full_time",
  essentialRequirements: ["Strong Excel skills"],
  experienceRequirements: "None required",
  jobCategory: "investment_banking_asset_management",
  normalizedTitle: "Graduate Analyst",
  preferredRequirements: ["SQL experience"],
  remoteType: null,
  responsibilities: ["Support corporate banking analysis"],
  seniorityLevel: "graduate",
  visaSponsorshipEvidence: "We are able to sponsor visas for this role.",
  visaSponsorshipStatus: "confirmed",
};

describe("enrichment output schema", () => {
  it("accepts a well-formed output", () => {
    expect(jobEnrichmentOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("accepts unknown keys (passthrough) and rejects invalid enums", () => {
    expect(jobEnrichmentOutputSchema.safeParse({ ...validOutput, inventedKey: "x" }).success).toBe(
      true,
    );
    expect(
      jobEnrichmentOutputSchema.safeParse({ ...validOutput, jobCategory: "MadeUp" }).success,
    ).toBe(false);
    expect(
      jobEnrichmentOutputSchema.safeParse({ ...validOutput, visaSponsorshipStatus: "maybe" })
        .success,
    ).toBe(false);
  });

  it("rejects oversize arrays", () => {
    expect(
      jobEnrichmentOutputSchema.safeParse({
        ...validOutput,
        coreSkills: Array.from({ length: 21 }, (_, index) => `skill ${index}`),
      }).success,
    ).toBe(false);
  });

  it("defaults to unknown sponsorship when the posting gives no evidence", () => {
    const output = jobEnrichmentOutputSchema.safeParse({
      ...validOutput,
      visaSponsorshipEvidence: null,
      visaSponsorshipStatus: "unknown",
    });
    expect(output.success).toBe(true);
    expect(() => validateEnrichmentOutput(output.data!)).not.toThrow();
  });

  it("rejects a non-unknown sponsorship status without evidence", () => {
    expect(() =>
      validateEnrichmentOutput({ ...validOutput, visaSponsorshipEvidence: null }),
    ).toThrow("job_enrichment_visa_status_without_evidence");
  });

  it("rejects unknown status with evidence attached", () => {
    expect(() =>
      validateEnrichmentOutput({ ...validOutput, visaSponsorshipStatus: "unknown" }),
    ).toThrow("job_enrichment_visa_evidence_without_status");
  });

  it("rejects sponsorship evidence that is not an exact quote from the posting", () => {
    expect(() =>
      validateEnrichmentOutput(validOutput, "The posting does not discuss immigration support."),
    ).toThrow("job_enrichment_visa_evidence_not_grounded");
  });

  it("accepts sponsorship evidence grounded in the posting", () => {
    expect(() =>
      validateEnrichmentOutput(
        validOutput,
        "Benefits. We are able to sponsor visas for this role. Apply today.",
      ),
    ).not.toThrow();
  });

  it("keeps the prompt version stable", () => {
    expect(JOB_ENRICHMENT_PROMPT_VERSION).toBe(1);
    expect(buildEnrichmentSystemPrompt()).toContain("visaSponsorshipStatus");
    expect(buildEnrichmentSystemPrompt()).toContain("investment_banking_asset_management");
  });

  it("truncates descriptions before sending them to the model", () => {
    const prompt = buildEnrichmentUserPrompt({
      applicationDeadline: null,
      descriptionText: "x".repeat(20_000),
      employmentType: null,
      locationText: "London",
      postedAt: null,
      remoteType: null,
      salaryCurrency: null,
      salaryMax: null,
      salaryMin: null,
      title: "Graduate Analyst",
    });
    expect(prompt.length).toBeLessThan(20_000);
  });
});
