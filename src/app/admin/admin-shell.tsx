"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { SignOutButton } from "../components/sign-out-button";

type AdminNavLink = Readonly<{ href: Route; label: string; section: string }>;

const navigationGroups: ReadonlyArray<Readonly<{ label: string; links: readonly AdminNavLink[] }>> =
  [
    {
      label: "Content",
      links: [
        { href: "/admin/content", label: "Resources", section: "content" },
        {
          href: "/admin/content?type=coaching_case",
          label: "Coaching cases",
          section: "coaching",
        },
        { href: "/admin/content/paths", label: "Preparation paths", section: "paths" },
        { href: "/admin/content/categories", label: "Categories", section: "categories" },
        { href: "/admin/content/tags", label: "Tags", section: "tags" },
      ],
    },
    {
      label: "Member services",
      links: [
        { href: "/admin/intelligence", label: "Intelligence", section: "intelligence" },
        { href: "/admin/group-mock", label: "Group Mock", section: "group-mock" },
        { href: "/admin/membership", label: "Memberships", section: "membership" },
      ],
    },
    {
      label: "Job catalogue",
      links: [
        { href: "/admin/job-sources", label: "Job sources", section: "job-sources" },
        { href: "/admin/source-discovery", label: "Source discovery", section: "discovery" },
        { href: "/admin/employers", label: "Employer research", section: "employers" },
      ],
    },
    {
      label: "Governance",
      links: [
        { href: "/admin/operations", label: "Operations", section: "operations" },
        { href: "/admin/operations/audit", label: "Audit trail", section: "audit" },
      ],
    },
  ];

function getActiveSection(pathname: string, type: string | null) {
  if (pathname.startsWith("/admin/content/paths")) return "paths";
  if (pathname === "/admin/content/categories") return "categories";
  if (pathname === "/admin/content/tags") return "tags";
  if (pathname.startsWith("/admin/intelligence")) return "intelligence";
  if (pathname.startsWith("/admin/group-mock")) return "group-mock";
  if (pathname === "/admin/operations") return "operations";
  if (pathname.startsWith("/admin/operations/audit")) return "audit";
  if (pathname === "/admin/job-sources") return "job-sources";
  if (pathname.startsWith("/admin/source-discovery")) return "discovery";
  if (pathname.startsWith("/admin/employers")) return "employers";
  if (pathname.startsWith("/admin/membership")) return "membership";
  if (pathname === "/admin/content" && type === "coaching_case") return "coaching";
  if (pathname.startsWith("/admin/content")) return "content";
  return null;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = getActiveSection(pathname, searchParams.get("type"));

  return (
    <div className="cms-shell">
      <aside className="cms-sidebar">
        <Link className="cms-brand" href="/admin">
          <span className="cms-brand-mark" aria-hidden="true">
            O
          </span>
          <span>OfferLab Admin</span>
        </Link>
        <nav aria-label="Content management" className="cms-sidebar-navigation">
          {navigationGroups.map((group) => (
            <section className="cms-nav-group" key={group.label}>
              <p>{group.label}</p>
              <div className="cms-nav-links">
                {group.links.map(({ href, label, section }) => (
                  <Link
                    aria-current={activeSection === section ? "page" : undefined}
                    href={href}
                    key={label}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <nav aria-label="CMS shortcuts" className="cms-sidebar-footer">
          <Link aria-current={pathname === "/admin" ? "page" : undefined} href="/admin">
            Overview
          </Link>
          <Link href="/member">Member workspace</Link>
          <SignOutButton />
        </nav>
      </aside>
      <div className="cms-main">{children}</div>
    </div>
  );
}
