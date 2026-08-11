"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const primaryLinks = [
  { href: "/admin/content", label: "Content", section: "content" },
  {
    href: "/admin/content?type=coaching_case",
    label: "Coaching cases",
    section: "coaching",
  },
  { href: "/admin/content/paths", label: "Preparation paths", section: "paths" },
  { href: "/admin/content/categories", label: "Categories", section: "categories" },
  { href: "/admin/content/tags", label: "Tags", section: "tags" },
  { href: "/admin/intelligence", label: "Intelligence", section: "intelligence" },
  { href: "/admin/group-mock", label: "Group Mock", section: "group-mock" },
  { href: "/admin/operations", label: "Operations", section: "operations" },
  { href: "/admin/job-sources", label: "Job sources", section: "job-sources" },
] as const;

function getActiveSection(pathname: string, type: string | null) {
  if (pathname.startsWith("/admin/content/paths")) return "paths";
  if (pathname === "/admin/content/categories") return "categories";
  if (pathname === "/admin/content/tags") return "tags";
  if (pathname.startsWith("/admin/intelligence")) return "intelligence";
  if (pathname.startsWith("/admin/group-mock")) return "group-mock";
  if (pathname === "/admin/operations") return "operations";
  if (pathname === "/admin/job-sources") return "job-sources";
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
          <span className="cms-brand-mark">O</span>
          <span>OfferLab CMS</span>
        </Link>
        <nav aria-label="Content management">
          {primaryLinks.map(({ href, label, section }) => (
            <Link
              aria-current={activeSection === section ? "page" : undefined}
              href={href as never}
              key={label}
            >
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="CMS shortcuts" className="cms-sidebar-footer">
          <Link href="/member/learn">View member workspace</Link>
          <Link aria-current={pathname === "/admin" ? "page" : undefined} href="/admin">
            Admin home
          </Link>
        </nav>
      </aside>
      <div className="cms-main">{children}</div>
    </div>
  );
}
