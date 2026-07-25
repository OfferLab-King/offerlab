import { describe, expect, it } from "vitest";
import { localRubricProvider } from "./local-rubric-provider";

describe("local Answer Coach prototype", () => {
  it("returns bounded observations without copying or inventing member facts", async () => {
    const privateMarker = "PRIVATE-MARKER-8472";
    const review = await localRubricProvider.review({
      draftAnswer: `We completed the work. ${privateMarker}`,
      keyPoints: "",
      question: "Tell me about teamwork",
      stories: [],
    });
    expect(review.priorities.map((item) => item.heading)).toEqual([
      "Develop the evidence",
      "Make your role explicit",
      "Ground the answer",
    ]);
    expect(JSON.stringify(review)).not.toContain(privateMarker);
    expect(review.coachingQuestions.length).toBeLessThanOrEqual(3);
  });

  it("recognises linked evidence and individual contribution", async () => {
    const review = await localRubricProvider.review({
      draftAnswer: `I clarified the objective, tested the options and helped the group agree. ${"Specific detail. ".repeat(30)}`,
      keyPoints: "",
      question: "Describe your contribution",
      stories: [
        {
          actions: "I tested the options.",
          reasoning: "The criteria kept the comparison fair.",
          reflection: "I would invite quieter voices earlier.",
          result: "The group agreed a recommendation.",
          situation: "The group had limited time.",
          task: "Reach a recommendation.",
        },
      ],
    });
    expect(review.strengths.map((item) => item.heading)).toEqual([
      "Useful level of detail",
      "Personal contribution",
      "Evidence connected",
    ]);
    expect(review.priorities).toEqual([]);
  });
});
