import { describe, expect, it } from "vitest";
import {
  careerEvidenceCoverage,
  careerReviewSchema,
  localCareerReviewProvider,
  validateCareerProviderReview,
  type CareerReview,
} from "./review";

function candidateReview(suggestedContent: string | null): CareerReview {
  return careerReviewSchema.parse({
    documentChecks: {
      length: "The document is concise.",
      readability: "The structure is clear.",
      specificity: "The evidence is specific.",
      targeting: "The target context is explicit.",
    },
    matchedRequirements: [],
    missingRequirements: ["typescript"],
    priorityActions: [
      {
        category: "Evidence",
        observation: "The TypeScript requirement is not evidenced.",
        suggestion: "Add a truthful example only if the source evidence supports it.",
      },
    ],
    strengths: [],
    suggestedContent,
    summary: "The document has relevant evidence and one important gap.",
  });
}

describe("career document review safety", () => {
  it("keeps deterministic evidence matches grounded in the document", async () => {
    const result = await localCareerReviewProvider.review({
      contentText:
        "PROFESSIONAL PROFILE\nWeb Developer with React and accessibility experience.\nEXPERIENCE\nBuilt an accessible React service for 40 colleagues.",
      jobDescription:
        "The role needs React, TypeScript, accessibility, Kubernetes and testing experience.",
      kind: "cv",
      targetCompany: "Example Ltd",
      targetRole: "Web Developer",
    });

    expect(result.review.matchedRequirements).toEqual(
      expect.arrayContaining(["accessibility", "React"]),
    );
    expect(result.review.missingRequirements).toEqual(
      expect.arrayContaining(["Kubernetes", "TypeScript"]),
    );
    expect(
      result.review.strengths.every(({ requirement }) =>
        result.review.matchedRequirements.includes(requirement),
      ),
    ).toBe(true);
    expect(result.review.strengths.map(({ requirement }) => requirement)).not.toContain(
      "TypeScript",
    );
  });

  it("does not create an ATS score, match percentage or interview prediction", async () => {
    const result = await localCareerReviewProvider.review({
      contentText:
        "SUMMARY\nGraduate Analyst with Excel and research experience.\nEXPERIENCE\nAnalysed 20 reports and presented findings.",
      jobDescription: "Seeking a Graduate Analyst with Excel and research experience.",
      kind: "cv",
      targetCompany: "Example Ltd",
      targetRole: "Graduate Analyst",
    });
    const serialized = JSON.stringify(result.review);

    expect(result.review.summary).toContain("assessed role requirements");
    expect(serialized).not.toMatch(
      /\b(?:ats|interview)\s+(?:score|chance|likelihood|probability)\b/iu,
    );
    expect(serialized).not.toMatch(/\b\d{1,3}%\s*(?:match|chance|likelihood|probability)\b/iu);
  });

  it("requires company targeting for a cover letter but not for a role-named CV", async () => {
    const shared = {
      contentText:
        "Graduate Analyst with research experience and evidence from a university project.",
      jobDescription: "Graduate Analyst role requiring research experience.",
      targetCompany: "Example Ltd",
      targetRole: "Graduate Analyst",
    } as const;

    const cv = await localCareerReviewProvider.review({ ...shared, kind: "cv" });
    const coverLetter = await localCareerReviewProvider.review({
      ...shared,
      kind: "cover_letter",
    });

    expect(cv.review.priorityActions.some(({ category }) => category === "Targeting")).toBe(false);
    expect(
      coverLetter.review.priorityActions.some(({ category }) => category === "Targeting"),
    ).toBe(true);
    expect(coverLetter.review.documentChecks.targeting).toContain("not yet explicit");
  });

  it("derives transparent evidence coverage from validated counts", () => {
    expect(
      careerEvidenceCoverage({
        ...candidateReview(null),
        matchedRequirements: ["SQL"],
        missingRequirements: ["Python", "Power BI"],
        strengths: [{ evidence: "SQL", requirement: "SQL" }],
      }),
    ).toEqual({
      assessed: 3,
      evidenced: 1,
      label: "Early evidence",
      score: 33,
    });
  });

  it("rejects model advice that tells a CV to add the target company", () => {
    const candidate = {
      ...candidateReview(null),
      priorityActions: [
        {
          category: "Targeting" as const,
          observation: "The company is not named.",
          suggestion: "Add Example Ltd to the opening profile.",
        },
      ],
    };
    expect(() =>
      validateCareerProviderReview(
        candidate,
        "I used SQL to analyse customer data.",
        "The role requires TypeScript.",
        { kind: "cv", targetCompany: "Example Ltd" },
      ),
    ).toThrow("career_review_cv_company_targeting_unsupported");
  });

  it("rejects a complete model-written version with an invented numeric claim", () => {
    const source =
      "I supported the reporting programme and wrote clear updates for colleagues across the project team.";
    const suggestion =
      "I supported the reporting programme, increased delivery speed by 37%, and wrote clear updates for colleagues across the project team while maintaining accurate records and communicating progress to stakeholders throughout the work.";

    expect(() => validateCareerProviderReview(candidateReview(suggestion), source)).toThrow(
      "career_review_suggestion_unsupported",
    );
  });

  it("rejects a complete model-written version that expands far beyond the source", () => {
    const source =
      "I researched customer needs, compared the findings and shared a concise recommendation with my project team.";
    const suggestion = Array.from({ length: 101 }, (_, index) =>
      index === 0 ? "I" : "supported",
    ).join(" ");

    expect(() => validateCareerProviderReview(candidateReview(suggestion), source)).toThrow(
      "career_review_suggestion_unsupported",
    );
  });

  it.each([
    "This CV has an ATS match score of 84%.",
    "The applicant is likely to receive an interview.",
    "This gives the applicant an interview probability of 70%.",
  ])("rejects prohibited hiring-outcome claims: %s", (summary) => {
    expect(() =>
      validateCareerProviderReview(
        { ...candidateReview(null), summary },
        "I researched customer needs and shared a recommendation with my project team.",
      ),
    ).toThrow("career_review_prohibited_outcome_claim");
  });

  it("rejects a represented requirement without exact supporting evidence", () => {
    const source = "I researched customer needs and shared a recommendation with my project team.";
    const candidate = {
      ...candidateReview(null),
      matchedRequirements: ["Kubernetes"],
    };

    expect(() => validateCareerProviderReview(candidate, source)).toThrow(
      "career_review_matched_requirement_without_evidence",
    );
  });

  it("requires strength evidence to be an exact source excerpt", () => {
    const source = "I built an accessible React service and gathered team feedback.";
    const candidate = {
      ...candidateReview(null),
      matchedRequirements: ["React"],
      strengths: [
        {
          evidence: "The candidate led a complex React transformation.",
          requirement: "React",
        },
      ],
    };

    expect(() => validateCareerProviderReview(candidate, source)).toThrow(
      "career_review_strength_ungrounded",
    );
  });

  it("rejects keyword-only evidence", () => {
    const candidate = {
      ...candidateReview(null),
      matchedRequirements: ["React"],
      missingRequirements: [],
      strengths: [{ evidence: "React", requirement: "React" }],
    };

    expect(() => validateCareerProviderReview(candidate, "Skills: React")).toThrow(
      "career_review_strength_ungrounded",
    );
  });

  it("requires every skill in a compound requirement to be evidenced", () => {
    const candidate = {
      ...candidateReview(null),
      matchedRequirements: ["React and TypeScript"],
      missingRequirements: [],
      strengths: [{ evidence: "Built a React service", requirement: "React and TypeScript" }],
    };

    expect(() =>
      validateCareerProviderReview(
        candidate,
        "Built a React service",
        "The role requires React and TypeScript experience.",
      ),
    ).toThrow("career_review_strength_ungrounded");
  });

  it("rejects duplicate requirements and incomplete selections", () => {
    expect(() =>
      validateCareerProviderReview(
        {
          ...candidateReview(null),
          missingRequirements: ["TypeScript", "typescript"],
        },
        "A document with evidence.",
      ),
    ).toThrow("career_review_requirement_duplicates");

    expect(() =>
      validateCareerProviderReview(
        {
          ...candidateReview(null),
          missingRequirements: ["React"],
        },
        "A document with evidence.",
        "React, TypeScript, accessibility, Kubernetes, testing and SQL experience.",
      ),
    ).toThrow("career_review_requirement_set_incomplete");
  });

  it("does not treat a keyword list as local document evidence", async () => {
    const result = await localCareerReviewProvider.review({
      contentText: "Skills: React, TypeScript\nExperience\nSupported a web project.",
      jobDescription: "The role requires React and TypeScript experience.",
      kind: "cv",
      targetCompany: "Example Ltd",
      targetRole: "Web Developer",
    });

    expect(result.review.matchedRequirements).toEqual([]);
    expect(result.review.missingRequirements).toEqual(
      expect.arrayContaining(["React", "TypeScript"]),
    );
  });

  it("uses cover-letter-specific deterministic checks", async () => {
    const result = await localCareerReviewProvider.review({
      contentText:
        "Dear hiring team,\nI am a passionate team player applying for the Graduate Analyst role.\n\nI used Excel to analyse reports.",
      jobDescription: "The role requires Excel experience.",
      kind: "cover_letter",
      targetCompany: "Example Ltd",
      targetRole: "Graduate Analyst",
    });

    expect(result.review.documentChecks.targeting).toContain("opening");
    expect(result.review.priorityActions.map(({ category }) => category)).toEqual(
      expect.arrayContaining(["Targeting", "Structure", "Voice"]),
    );
    expect(
      result.review.priorityActions.every((action) => !/\bCV\b/iu.test(action.suggestion)),
    ).toBe(true);
  });

  it("rejects represented or missing requirements absent from the selected target", () => {
    const source = "I built an accessible React service and gathered team feedback.";
    const candidate = {
      ...candidateReview(null),
      matchedRequirements: ["React"],
      missingRequirements: ["Kubernetes"],
    };

    expect(() =>
      validateCareerProviderReview(
        candidate,
        source,
        "The role requires React, accessibility and collaborative delivery.",
      ),
    ).toThrow("career_review_requirement_absent_from_target");
  });

  it("deduplicates invalid stored counts before calculating coverage", () => {
    expect(
      careerEvidenceCoverage({
        ...candidateReview(null),
        matchedRequirements: ["SQL", "sql"],
        missingRequirements: ["Python", "SQL"],
        strengths: [{ evidence: "Used SQL for reporting", requirement: "SQL" }],
      }),
    ).toEqual({
      assessed: 2,
      evidenced: 0,
      label: "Early evidence",
      score: 0,
    });
  });

  it("rejects even a plausible bounded rewrite until edits carry source anchors", () => {
    const source =
      "I built an accessible React service used by 40 colleagues, documented the changes and gathered feedback from the team.";
    const suggestion =
      "I built an accessible React service used by 40 colleagues. I documented the changes, gathered feedback from the team and kept the wording focused on evidence that is present in my original experience.";

    expect(() => validateCareerProviderReview(candidateReview(suggestion), source)).toThrow(
      "career_review_suggestion_unsupported",
    );
  });

  it("rejects an invented non-numeric qualification", () => {
    const source =
      "I built an accessible React service, documented the changes and gathered team feedback.";
    const suggestion =
      "I built an accessible React service as a certified cloud architect, documented the changes and gathered team feedback.";

    expect(() => validateCareerProviderReview(candidateReview(suggestion), source)).toThrow(
      "career_review_suggestion_unsupported",
    );
  });
});
