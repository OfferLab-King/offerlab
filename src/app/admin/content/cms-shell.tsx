import Link from "next/link";

const links = [
  ["Content", "/admin/content"],
  ["Coaching cases", "/admin/content?type=coaching_case"],
  ["Preparation paths", "/admin/content/paths"],
  ["Categories", "/admin/content/categories"],
  ["Tags", "/admin/content/tags"],
] as const;

export function CmsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cms-shell">
      <aside className="cms-sidebar">
        <Link className="cms-brand" href="/admin">
          <span className="cms-brand-mark">O</span>
          <span>OfferLab CMS</span>
        </Link>
        <nav aria-label="Content management">
          {links.map(([label, href]) => (
            <Link href={href as never} key={label}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="cms-sidebar-footer">
          <Link href="/member/learn">View member workspace</Link>
          <Link href="/admin">Admin home</Link>
        </div>
      </aside>
      <div className="cms-main">{children}</div>
    </div>
  );
}
