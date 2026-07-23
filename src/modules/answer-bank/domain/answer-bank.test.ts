import { describe, expect, it } from "vitest";
import { nextAction, parseAnswer, parseStory } from "./answer-bank";
describe("answer bank rules", () => {
  it("validates Ready stories", () =>
    expect(
      parseStory({ title: "Team", experienceType: "education", ready: true, competencies: [] }),
    ).toMatchObject({ ok: false }));
  it("accepts complete STAR plus reasoning and reflection", () =>
    expect(
      parseStory({
        title: "Team",
        experienceType: "education",
        situation: "Context",
        task: "Goal",
        actions: "I acted",
        reasoning: "Because",
        result: "Result",
        reflection: "Learned",
        competencies: ["teamwork"],
        ready: true,
      }),
    ).toMatchObject({ ok: true }));
  it("applies family-aware Ready validation", () => {
    expect(
      parseAnswer({
        customQuestion: "Why us?",
        questionFamily: "motivation_and_fit",
        title: "Why",
        draftAnswer: "Because the work fits.",
        keyPoints: "Fit",
        storyIds: [],
        ready: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      parseAnswer({
        customQuestion: "Team?",
        questionFamily: "competency_and_behavioural",
        title: "Team",
        draftAnswer: "Example",
        keyPoints: "Point",
        storyIds: [],
        ready: true,
      }),
    ).toMatchObject({ ok: false });
  });
  it("rejects duplicate stories", () => {
    const id = "20000000-0000-4000-8000-000000000001";
    expect(
      parseAnswer({
        customQuestion: "Q",
        questionFamily: "situational",
        title: "Q",
        storyIds: [id, id],
      }),
    ).toMatchObject({ ok: false });
  });
  it("selects deterministic next actions", () =>
    expect(
      nextAction({ personalIntroduction: false, readyStories: 0, readyAnswers: 0, covered: [] }),
    ).toContain("personal introduction"));
});
