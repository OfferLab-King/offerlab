import { describe, expect, it } from "vitest";
import { coachingCaseTone } from "./coaching-case-tone";

describe("coachingCaseTone", () => {
  it("gives additional comments deterministic non-duplicated hues", () => {
    const hues = Array.from(
      { length: 20 },
      (_, index) => coachingCaseTone(index)["--case-comment-hue"],
    );

    expect(new Set(hues).size).toBe(hues.length);
    expect(coachingCaseTone(7)).toEqual(coachingCaseTone(7));
    expect(hues.every((hue) => Number(hue) >= 0 && Number(hue) < 360)).toBe(true);
  });

  it("uses the first tone for invalid negative positions", () => {
    expect(coachingCaseTone(-1)).toEqual(coachingCaseTone(0));
  });
});
