import type { Route } from "next";

export type SiteNavigationLink = Readonly<{ href: Route; label: string }>;

export const publicNavLinks = [
  { href: "/jobs", label: "Jobs" },
  { href: "/employers", label: "Employers" },
  { href: "/intelligence", label: "Recruitment Intelligence" },
  { href: "/plans", label: "Plans" },
] as const satisfies readonly SiteNavigationLink[];

export const memberNavLinks = [
  { href: "/member", label: "Workspace" },
  { href: "/jobs", label: "Jobs" },
  { href: "/employers", label: "Employers" },
  { href: "/member/learn/answer-bank", label: "Answer Bank" },
  { href: "/member/learn", label: "Library" },
] as const satisfies readonly SiteNavigationLink[];

export const memberAccountLinks = [
  { href: "/member/membership", label: "Membership" },
  { href: "/member/onboarding", label: "Profile" },
] as const satisfies readonly SiteNavigationLink[];

/**
 * Home matches exactly its route; every other destination matches itself and
 * its descendants so nested pages keep the same active link.
 * Workspace covers its private sub-pages (applications, documents, saved-jobs)
 * but not the distinct Answer Bank or Library areas.
 */
export function isDestinationCurrent(pathname: string, href: string): boolean {
  if (href === "/member") {
    return (
      pathname === "/member" ||
      pathname.startsWith("/member/applications") ||
      pathname.startsWith("/member/cvs") ||
      pathname.startsWith("/member/cover-letters") ||
      pathname.startsWith("/member/documents") ||
      pathname.startsWith("/member/saved-jobs")
    );
  }
  if (href === "/member/learn") {
    return (
      pathname === "/member/learn" ||
      (pathname.startsWith("/member/learn/") && !pathname.startsWith("/member/learn/answer-bank"))
    );
  }
  if (href === "/member/learn/answer-bank") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
