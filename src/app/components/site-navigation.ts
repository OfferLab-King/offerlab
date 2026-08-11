import type { Route } from "next";

export type SiteNavigationLink = Readonly<{ href: Route; label: string }>;

export const publicNavLinks = [
  { href: "/jobs", label: "Jobs" },
  { href: "/employers", label: "Employers" },
  { href: "/intelligence", label: "Recruitment Intelligence" },
] as const satisfies readonly SiteNavigationLink[];

export const memberNavLinks = [
  { href: "/member", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/employers", label: "Employers" },
  { href: "/member/applications", label: "Applications" },
  { href: "/member/cvs", label: "CVs" },
  { href: "/member/cover-letters", label: "Cover letters" },
  { href: "/member/learn", label: "Prepare" },
  { href: "/member/onboarding", label: "Profile" },
] as const satisfies readonly SiteNavigationLink[];

/**
 * Home matches exactly its route; every other destination matches itself and
 * its descendants so nested pages keep the same active link.
 */
export function isDestinationCurrent(pathname: string, href: string): boolean {
  if (href === "/member") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
