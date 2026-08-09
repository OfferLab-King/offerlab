import { describe, expect, it } from "vitest";
import { careerDocumentVersionInputSchema, careerJobTargetInputSchema } from "./career-document";
import { localCareerReviewProvider, validateCareerProviderReview } from "./review";

describe("career document contracts", () => {
  it("requires a company and role when a job description is supplied", () => {
    const result = careerDocumentVersionInputSchema.safeParse({
      contentText:
        "A sufficiently detailed CV version containing truthful experience and evidence.",
      jobDescription: "Build and maintain accessible web applications.",
      label: "Web role",
      targetCompany: null,
      targetJobId: null,
      targetRole: null,
    });
    expect(result.success).toBe(false);
  });

  it("keeps manual and provider job identities distinct", () => {
    expect(
      careerJobTargetInputSchema.safeParse({
        applyUrl: null,
        companyName: "Example Ltd",
        description: "A role description.",
        employmentType: null,
        fetchedAt: null,
        location: null,
        provider: "manual",
        providerJobId: "external-id",
        publishedAt: null,
        roleTitle: "Analyst",
        sourcePublisher: null,
        sourceUrl: null,
      }).success,
    ).toBe(false);
  });

  it("returns a bounded deterministic evidence review without predicting employability", async () => {
    const result = await localCareerReviewProvider.review({
      contentText:
        "PROFESSIONAL PROFILE\nWeb developer using React and accessibility practices.\nEXPERIENCE\nBuilt a React service used by 40 colleagues.",
      jobDescription: "We need React, TypeScript, accessibility and testing experience.",
      kind: "cv",
      targetCompany: "Example Ltd",
      targetRole: "Web Developer",
    });
    expect(result.review.matchedRequirements).toContain("React");
    expect(result.review.summary).toContain("assessed role requirements");
    expect(result.review.suggestedContent).toBeNull();
  });

  it("rejects a model suggestion that invents a number", () => {
    expect(() =>
      validateCareerProviderReview(
        {
          documentChecks: {
            length: "Concise.",
            readability: "Clear.",
            specificity: "Specific.",
            targeting: "Targeted.",
          },
          matchedRequirements: [],
          missingRequirements: [],
          priorityActions: [
            { category: "Evidence", observation: "Needs evidence.", suggestion: "Add evidence." },
          ],
          strengths: [],
          suggestedContent:
            "I improved revenue by 35% through a programme that I led across the organisation with strong results.",
          summary: "Review complete.",
        },
        "I supported a revenue reporting programme.",
      ),
    ).toThrow("career_review_suggestion_unsupported");
  });
});
