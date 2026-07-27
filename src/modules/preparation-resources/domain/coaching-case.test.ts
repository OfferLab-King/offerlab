import { describe, expect, it } from "vitest";
import { coachingCaseDetailSchema } from "./coaching-case";

const original = "We did the work. It went well.";
const valid = {
  changes: [
    {
      category: "Evidence",
      end: 16,
      explanation: "Make ownership visible.",
      heading: "Name the action",
      id: "action",
      replacement: "I tested the options.",
      start: 0,
    },
    {
      category: "Evidence",
      end: 30,
      explanation: "Show the result.",
      heading: "Evidence the result",
      id: "result",
      replacement: "The panel adopted my recommendation.",
      start: 17,
    },
  ],
  improvedAnswer: "I tested the options. The panel adopted my recommendation.",
  keyWeaknesses: ["Vague ownership"],
  originalAnswer: original,
  practicePrompt: "Underline your individual actions.",
  question: "Tell me about a team.",
  whyStronger: "The revision makes the action and result inspectable.",
} as const;

describe("structured coaching cases", () => {
  it("accepts an exact, reproducible before-and-after edit", () => {
    expect(coachingCaseDetailSchema.parse(valid).improvedAnswer).toContain("recommendation");
  });

  it("rejects overlapping anchors and an improved answer not produced by the changes", () => {
    expect(
      coachingCaseDetailSchema.safeParse({
        ...valid,
        changes: [...valid.changes, { ...valid.changes[1], id: "overlap", start: 10 }],
      }).success,
    ).toBe(false);
    expect(
      coachingCaseDetailSchema.safeParse({
        ...valid,
        improvedAnswer: "A polished answer invented elsewhere.",
      }).success,
    ).toBe(false);
  });
});
