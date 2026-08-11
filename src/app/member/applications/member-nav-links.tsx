"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/member", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/member/applications", label: "Applications" },
  { href: "/member/cvs", label: "CVs" },
  { href: "/member/cover-letters", label: "Cover letters" },
  { href: "/member/learn", label: "Prepare" },
  { href: "/member/onboarding", label: "Profile" },
] as const;

export function isMemberDestinationCurrent(pathname: string, href: string): boolean {
  return href === "/member" ? pathname === href : pathname.startsWith(href);
}

export function MemberNavLinks() {
  const pathname = usePathname();
  return links.map((link) => {
    const current = isMemberDestinationCurrent(pathname, link.href);
    return (
      <Link aria-current={current ? "page" : undefined} href={link.href} key={link.href}>
        {link.label}
      </Link>
    );
  });
}
