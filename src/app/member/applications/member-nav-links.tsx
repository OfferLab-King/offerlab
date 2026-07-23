"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/member", label: "Home" },
  { href: "/member/applications", label: "Applications" },
  { href: "/member/learn", label: "Prepare" },
  { href: "/member/onboarding", label: "Profile" },
] as const;

export function MemberNavLinks() {
  const pathname = usePathname();
  return links.map((link) => {
    const current =
      link.href === "/member" ? pathname === link.href : pathname.startsWith(link.href);
    return (
      <Link aria-current={current ? "page" : undefined} href={link.href} key={link.href}>
        {link.label}
      </Link>
    );
  });
}
