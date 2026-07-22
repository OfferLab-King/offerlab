import { describe, expect, it } from "vitest";
import type { MemberPath } from "../../../modules/learning-paths/infrastructure/learning-path-repository";
import {
  estimatedDuration,
  learnDestination,
  nextPreparationArea,
  preparationAreaPreview,
  preparationAreaProgress,
  readyAreaCount,
  resourceAction,
  selectContinuePreparation,
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
});
