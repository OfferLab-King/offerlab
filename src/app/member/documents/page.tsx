import Link from "next/link";
import { redirect } from "next/navigation";

import { readCareerDocuments } from "../../../modules/career-documents/application/career-documents";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import { MemberApplicationsHeader } from "../applications/member-applications-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DocumentsOverviewPage() {
  const { userId } = await requireMember();
  if (!(await readOnboardingProfile(userId))?.completedAt) redirect("/member/onboarding");
  const [cvs, coverLetters] = await Promise.all([
    readCareerDocuments(userId, "cv"),
    readCareerDocuments(userId, "cover_letter"),
  ]);
  return (
    <main className="applications-shell workspace-shell">
      <MemberApplicationsHeader />
      <section className="workspace-hero compact-hero">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Your documents</h1>
          <p className="intro">One base, many truthful targeted versions. All private.</p>
        </div>
      </section>
      <div className="workspace-document-grid">
        <Link className="card workspace-side-card" href="/member/cvs">
          <h2>CVs</h2>
          <p className="hint">
            {cvs.length} CV{cvs.length === 1 ? "" : "s"}
          </p>
          <p>{cvs.length ? cvs[0]!.title : "No CVs yet — upload a PDF or DOCX"}</p>
          <span className="workspace-row-action">Open CVs →</span>
        </Link>
        <Link className="card workspace-side-card" href="/member/cover-letters">
          <h2>Cover letters</h2>
          <p className="hint">
            {coverLetters.length} letter{coverLetters.length === 1 ? "" : "s"}
          </p>
          <p>{coverLetters.length ? coverLetters[0]!.title : "No letters yet"}</p>
          <span className="workspace-row-action">Open cover letters →</span>
        </Link>
      </div>
    </main>
  );
}
