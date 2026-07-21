import { describe, expect, it } from "vitest";
import {
  normalizeMarkdown,
  normalizeControlledUrl,
  normalizeSearch,
  normalizeSingleLine,
  parseYouTubeVideoId,
  resourceDraftSchema,
  slugSchema,
} from "./resource";
describe("knowledge resource validation", () => {
  it("normalizes Unicode and whitespace", () =>
    expect(normalizeSingleLine("  Cafe\u0301  guide ")).toBe("Café guide"));
  it("preserves Markdown paragraphs", () =>
    expect(normalizeMarkdown(" First\r\n\r\nSecond \r\n")).toBe("First\n\nSecond"));
  it("rejects reserved and malformed slugs", () => {
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("Bad--slug").success).toBe(false);
  });
  it("bounds safe search", () => {
    expect(normalizeSearch("a".repeat(121))).toBe("");
    expect(normalizeSearch("hello\u0000world")).toBe("");
  });
  it("controls YouTube inputs", () => {
    expect(parseYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideoId("https://evil.example/dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeVideoId("javascript:alert(1)")).toBeNull();
  });
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java%73cript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//evil.example/path",
  ])("rejects unsafe controlled destination %s", (value) => {
    expect(normalizeControlledUrl(value)).toBeNull();
  });
  it("accepts only normalized HTTPS and approved relative controlled destinations", () => {
    expect(normalizeControlledUrl("/learn/checklist?copy=1")).toBe("/learn/checklist?copy=1");
    expect(normalizeControlledUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeControlledUrl("http://example.com/a")).toBeNull();
    expect(normalizeControlledUrl("https://user:pass@example.com/a")).toBeNull();
  });
  it("rejects unknown fields and unsafe controls", () => {
    const base = {
      accessLevel: "member",
      estimatedMinutes: 10,
      markdownBody: "Body",
      primaryCategoryId: null,
      resourceType: "guide",
      shortDescription: "Summary",
      slug: "valid-slug",
      title: "Title",
    };
    expect(resourceDraftSchema.safeParse({ ...base, unknown: true }).success).toBe(false);
    expect(resourceDraftSchema.safeParse({ ...base, markdownBody: "bad\u0000body" }).success).toBe(
      false,
    );
  });
});
