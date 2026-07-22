import { describe, expect, it } from "vitest";
import type { MemberPath } from "../../../modules/learning-paths/infrastructure/learning-path-repository";
import { learnDestination, resourceAction, selectContinuePreparation } from "./learn-presenters";

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
});
