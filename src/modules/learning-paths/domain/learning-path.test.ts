import { describe, expect, it } from "vitest";
import {
  calculateProgress,
  duplicateResourceIds,
  firstIncomplete,
  publicationErrors,
} from "./learning-path";

const item = (resourceId: string) => ({ contextNote: "", resourceId });
describe("learning paths", () => {
  it("calculates derived progress", () => expect(calculateProgress(2, 3)).toBe(67));
  it("finds the first incomplete item", () =>
    expect(firstIncomplete([{ completedAt: new Date() }, { completedAt: null }])).toEqual({
      completedAt: null,
    }));
  it("detects duplicate resources across sections", () =>
    expect(
      duplicateResourceIds([
        { description: "", heading: "One", items: [item("a")] },
        { description: "", heading: "Two", items: [item("a")] },
      ]),
    ).toEqual(["a"]));
  it("requires publishable structure", () =>
    expect(
      publicationErrors({
        introduction: "",
        primaryCategoryId: null,
        sections: [],
        shortDescription: "",
        slug: "path",
        title: "",
      }),
    ).toHaveLength(3));
});
