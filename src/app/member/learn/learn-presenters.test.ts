import { describe, expect, it } from "vitest";
import type { MemberPath } from "../../../modules/learning-paths/infrastructure/learning-path-repository";
import {
  activityAfter,
  estimatedDuration,
  learnDestination,
  nextPreparationArea,
  planKind,
  planStatus,
  preparationAreaPreview,
  preparationAreaProgress,
  readyAreaCount,
  resourceAction,
  resourcePlanContext,
  selectContinuePreparation,
  showPlanProgress,
} from "./learn-presenters";

function path(overrides: Partial<MemberPath>): MemberPath {
  return {
    categoryName: "Interviews",
    completedCount: 0,
    estimatedMinutes: 20,
    following: false,
    id: crypto.randomUUID(),
    introduction: "",
    progress: 0,
    sections: [],
    shortDescription: "Prepare.",
    slug: "prepare",
    title: "Prepare",
    totalCount: 2,
    ...overrides,
  };
}

describe("Learn presentation", () => {
  it("selects the first stable followed incomplete plan", () => {
    const complete = path({ following: true, progress: 100, slug: "complete" });
    const firstIncomplete = path({ following: true, progress: 50, slug: "first" });
    const secondIncomplete = path({ following: true, progress: 25, slug: "second" });
    expect(selectContinuePreparation([complete, firstIncomplete, secondIncomplete])?.slug).toBe(
      "first",
    );
    expect(selectContinuePreparation([complete])).toBeNull();
  });

  it("uses context-sensitive resource actions", () => {
    expect(resourceAction(false)).toBe("Start");
    expect(resourceAction(true)).toBe("Review");
  });

  it("separates the interview foundation from recruitment-stage plans", () => {
    expect(planKind(path({ slug: "build-your-interview-answer-bank" }))).toBe("foundation");
    expect(planKind(path({ slug: "assessment-centre-preparation" }))).toBe("stage");
  });

  it("presents untouched, active, and ready plan states without empty progress", () => {
    const untouched = path({ completedCount: 0, progress: 0 });
    const active = path({ completedCount: 2, progress: 40 });
    const ready = path({ completedCount: 5, progress: 100 });
    expect(planStatus(untouched)).toBe("Not started");
    expect(showPlanProgress(untouched)).toBe(false);
    expect(planStatus(active)).toBe("In progress");
    expect(showPlanProgress(active)).toBe(true);
    expect(planStatus(ready)).toBe("Ready");
    expect(showPlanProgress(ready)).toBe(false);
  });

  it("identifies the active Learn destination", () => {
    expect(learnDestination("/member/learn")).toBe("overview");
    expect(learnDestination("/member/learn/paths/video-interview")).toBe("paths");
    expect(learnDestination("/member/learn/resources")).toBe("resources");
  });

  it("derives preparation-area readiness and the next area from resource completion", () => {
    const item = (completedAt: Date | null) => ({
      completedAt,
      contextNote: "",
      estimatedMinutes: 10,
      id: crypto.randomUUID(),
      resourceId: crypto.randomUUID(),
      resourceType: "guide",
      slug: crypto.randomUUID(),
      title: "Resource",
    });
    const sections = [
      { id: "one", heading: "Ready area", description: "", items: [item(new Date())] },
      {
        id: "two",
        heading: "Active area",
        description: "",
        items: [item(new Date()), item(null)],
      },
      { id: "three", heading: "New area", description: "", items: [item(null)] },
    ] satisfies MemberPath["sections"];
    expect(preparationAreaProgress(sections[0]!)).toMatchObject({
      status: "Ready",
      completedCount: 1,
      totalCount: 1,
    });
    expect(preparationAreaProgress(sections[1]!)).toMatchObject({
      status: "In progress",
      completedCount: 1,
      totalCount: 2,
    });
    expect(preparationAreaProgress(sections[2]!)).toMatchObject({
      status: "Not started",
      completedCount: 0,
      totalCount: 1,
    });
    expect(readyAreaCount(path({ sections }))).toBe(1);
    expect(nextPreparationArea(path({ sections }))?.heading).toBe("Active area");
  });

  it("previews up to four areas and aggregates a readable duration", () => {
    const sections = ["One", "Two", "Three", "Four", "Five"].map((heading) => ({
      id: heading,
      heading,
      description: "",
      items: [],
    })) as MemberPath["sections"];
    expect(preparationAreaPreview(path({ sections }))).toEqual({
      headings: ["One", "Two", "Three", "Four"],
      remaining: 1,
    });
    expect(estimatedDuration(91)).toBe("About 95 min");
    expect(estimatedDuration(0)).toBe("Flexible timing");
  });

  it("builds plan context and selects the next ordered incomplete activity", () => {
    const item = (slug: string, completedAt: Date | null = null) => ({
      completedAt,
      contextNote: "",
      estimatedMinutes: 10,
      id: crypto.randomUUID(),
      resourceId: crypto.randomUUID(),
      resourceType: "guide",
      slug,
      title: slug,
    });
    const first = item("first");
    const second = item("second");
    const third = item("third", new Date());
    const fourth = item("fourth");
    const memberPath = path({
      sections: [
        { id: "area-one", heading: "First area", description: "", items: [first, second] },
        { id: "area-two", heading: "Second area", description: "", items: [third, fourth] },
      ],
    });
    expect(activityAfter(memberPath, first.resourceId)?.slug).toBe("second");
    expect(activityAfter(memberPath, second.resourceId)?.slug).toBe("fourth");
    expect(resourcePlanContext(memberPath, second.resourceId)).toMatchObject({
      activityNumber: 2,
      activityTotal: 2,
      previousActivity: { slug: "first" },
      nextActivity: { slug: "fourth" },
      section: { heading: "First area" },
    });
    expect(resourcePlanContext(memberPath, crypto.randomUUID())).toBeNull();
  });
});
