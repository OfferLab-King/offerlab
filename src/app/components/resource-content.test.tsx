import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceContent } from "./resource-content";

const base = {
  accessLevel: "public",
  categoryName: "Tests",
  completedAt: null,
  estimatedMinutes: 5,
  id: "00000000-0000-4000-8000-000000000001",
  links: [],
  publicationState: "published",
  relatedResources: [],
  resourceKey: "test",
  resourceType: "guide",
  savedAt: null,
  shortDescription: "Summary",
  slug: "test",
  stages: [],
  title: "Title",
  version: 1,
  youtubeVideoId: null,
} as const;
function render(markdownBody: string) {
  return renderToStaticMarkup(<ResourceContent resource={{ ...base, markdownBody }} />);
}

describe("rendered resource security", () => {
  it("renders GFM structure without executable raw HTML", () => {
    const html = render(
      "# Heading\n\n- item\n\n> quote\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n`inline`\n\n```js\nalert(1)\n```\n\n<script>alert(1)</script><iframe src=x></iframe><object></object><embed><form></form><style>body{display:none}</style>",
    );
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain("<blockquote>");
    expect(html).not.toMatch(/<(script|iframe|object|embed|form|style)\b/i);
  });
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java%73cript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,x",
    "file:///tmp/x",
    "//evil.example/x",
  ])("does not emit unsafe href %s", (href) => {
    const html = render(`[unsafe](${href})`);
    expect(html).not.toMatch(/href=/);
  });
  it("renders safe destinations with external security attributes", () => {
    const html = render("[internal](/learn/test) [external](https://example.com/x)");
    expect(html).toContain('href="/learn/test"');
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
  it("does not render Markdown images", () => {
    const html = render("![secret](https://example.com/secret.png)");
    expect(html).not.toContain("<img");
    expect(html).toContain("secret");
  });
});
