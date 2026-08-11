import { describe, expect, it } from "vitest";

import { htmlToPlainText } from "./html-text";

describe("htmlToPlainText", () => {
  it("converts headings, lists and paragraphs into plain text", () => {
    const text = htmlToPlainText(
      "<h1>Role</h1><p>First paragraph.</p><ul><li>Point one</li><li>Point two</li></ul>",
    );
    expect(text).toContain("Role");
    expect(text).toContain("First paragraph.");
    expect(text).toContain("Point one");
    expect(text).toContain("Point two");
  });

  it("strips scripts, styles and inline code tags", () => {
    const text = htmlToPlainText(
      "<div><script>alert('xss')</script><p>Safe <b>bold</b> text <code>x=1</code></p></div>",
    );
    expect(text).not.toContain("xss");
    expect(text).not.toContain("<script>");
    expect(text).toContain("Safe bold text");
  });

  it("collapses whitespace and nbsp", () => {
    const text = htmlToPlainText("<p>Hello\u00a0\u00a0 world\n\n there</p>");
    expect(text).toBe("Hello world there");
  });

  it("handles empty and malformed input", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("plain text only")).toBe("plain text only");
  });

  it("bounds output length", () => {
    const text = htmlToPlainText(`<p>${"word ".repeat(20_000)}</p>`, 1_000);
    expect(text.length).toBeLessThanOrEqual(1_001);
  });
});
