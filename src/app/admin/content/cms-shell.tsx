"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const links = [
  { href: "/admin/content", label: "Content", section: "content" },
  {
    href: "/admin/content?type=coaching_case",
    label: "Coaching cases",
    section: "coaching",
  },
  { href: "/admin/content/paths", label: "Preparation paths", section: "paths" },
  { href: "/admin/content/categories", label: "Categories", section: "categories" },
  { href: "/admin/content/tags", label: "Tags", section: "tags" },
] as const;

export function CmsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = pathname.startsWith("/admin/content/paths")
    ? "paths"
    : pathname === "/admin/content/categories"
      ? "categories"
      : pathname === "/admin/content/tags"
        ? "tags"
        : pathname === "/admin/content" && searchParams.get("type") === "coaching_case"
          ? "coaching"
          : "content";
  return (
    <div className="cms-shell">
      <aside className="cms-sidebar">
        <Link className="cms-brand" href="/admin">
          <span className="cms-brand-mark">O</span>
          <span>OfferLab CMS</span>
        </Link>
        <nav aria-label="Content management">
          {links.map(({ href, label, section }) => (
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
          <Link href="/admin">Admin home</Link>
        </nav>
      </aside>
      <div className="cms-main">{children}</div>
    </div>
  );
}
