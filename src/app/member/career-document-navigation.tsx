import Link from "next/link";

export function CareerDocumentNavigation({ active }: { active: "cv" | "cover_letter" }) {
  return (
    <nav aria-label="Application documents" className="view-tabs career-document-tabs">
      <Link aria-current={active === "cv" ? "page" : undefined} href="/member/cvs">
        CVs
      </Link>
      <Link
        aria-current={active === "cover_letter" ? "page" : undefined}
        href="/member/cover-letters"
      >
        Cover letters
      </Link>
    </nav>
  );
}
