import { describe, expect, it } from "vitest";

import { extractJobLinks } from "./html-job-extraction";

describe("extractJobLinks", () => {
  it("keeps genuine job links and their text", () => {
    const html = `
      <a href="/careers/software-engineer">Software Engineer</a>
      <a href="/job/london/product-manager-123">Product Manager - London</a>
      <a href="/positions/graduate-analyst">Graduate Analyst</a>
      <a href="/vacancies/analyst-2026">Analyst - 2026 Intake</a>
    `;
    const links = extractJobLinks(html, "https://employer.example.com/careers");
    expect(links.map((link) => link.url)).toEqual([
      "https://employer.example.com/careers/software-engineer",
      "https://employer.example.com/job/london/product-manager-123",
      "https://employer.example.com/positions/graduate-analyst",
      "https://employer.example.com/vacancies/analyst-2026",
    ]);
  });

  it("rejects generic navigation links such as Careers or Search for a job", () => {
    const html = `
      <a href="/careers">Careers</a>
      <a href="/search">Search for a job</a>
      <a href="/careers/search">View all jobs</a>
      <a href="/about">About us</a>
      <a href="/why-work-here">Why work here</a>
      <a href="/">Home</a>
      <a href="/careers/software-engineer">Software Engineer</a>
    `;
    const links = extractJobLinks(html, "https://employer.example.com/careers");
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("https://employer.example.com/careers/software-engineer");
  });

  it("keeps job-like anchors on index pages even when the path segment is short", () => {
    const html = `
      <a href="/job/12345">Senior Data Analyst</a>
      <a href="/careers">Careers</a>
    `;
    const links = extractJobLinks(html, "https://employer.example.com");
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("https://employer.example.com/job/12345");
  });
});
