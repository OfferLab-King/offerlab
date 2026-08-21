import Link from "next/link";
import type { CareerDocumentKind } from "../../modules/career-documents/domain/career-document";
import type { CareerDocument } from "../../modules/career-documents/infrastructure/career-repository";
import { CareerDocumentNavigation } from "./career-document-navigation";
import { CareerDocumentUploadForm } from "./career-document-upload-form";

export function CareerDocumentList({
  documents,
  kind,
}: {
  documents: readonly CareerDocument[];
  kind: CareerDocumentKind;
}) {
  const cv = kind === "cv";
  const href = cv ? "/member/cvs" : "/member/cover-letters";
  return (
    <main className="applications-shell workspace-shell">
      <section className="workspace-hero compact-hero">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>{cv ? "CVs" : "Cover letters"}</h1>
          <p className="intro">
            {cv
              ? "A strong base, then truthful role-specific versions. Latest version is the current one."
              : "Company- and role-specific letters — grounded in your base evidence."}
          </p>
        </div>
        <Link
          className="button-link button-secondary"
          href={cv ? "/member/cover-letters" : "/member/cvs"}
        >
          Switch to {cv ? "cover letters" : "CVs"} →
        </Link>
      </section>
      <CareerDocumentNavigation active={kind} />
      <div className="workspace-grid">
        <div className="workspace-main">
          <section aria-labelledby="document-library" className="workspace-section">
            <div className="workspace-section-header">
              <h2 id="document-library">
                Your library <span className="hint">· {documents.length} active</span>
              </h2>
              <span className="hint">Private · owner-scoped</span>
            </div>
            {documents.length ? (
              <ul className="workspace-application-list">
                {documents.map((document) => (
                  <li className="workspace-application-row" key={document.id}>
                    <div className="workspace-application-meta">
                      <h3 className="workspace-application-role">{document.title}</h3>
                      <p className="hint">
                        {document.versionCount} version{document.versionCount === 1 ? "" : "s"}
                        {document.latestVersion?.targetRole && document.latestVersion.targetCompany
                          ? ` · ${document.latestVersion.targetRole} at ${document.latestVersion.targetCompany}`
                          : " · Base document"}{" "}
                        · {document.updatedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                      </p>
                    </div>
                    <Link className="workspace-row-action" href={`${href}/${document.id}`}>
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="card empty-state">
                <h3>No {cv ? "CVs" : "cover letters"} yet</h3>
                <p>Upload a PDF or DOCX. AI review never starts automatically.</p>
              </div>
            )}
          </section>
        </div>
        <aside className="workspace-side">
          <section aria-labelledby="upload-document" className="card workspace-side-card">
            <h2 id="upload-document">Add {cv ? "a CV" : "a cover letter"}</h2>
            <p className="hint">
              PDF or DOCX, up to 5 MB. Text is extracted and the binary is discarded.
            </p>
            <CareerDocumentUploadForm kind={kind} />
          </section>
          <section className="card workspace-side-card workspace-tip">
            <p className="eyebrow">How versions work</p>
            <p className="hint">
              The highest immutable revision is the current version. Saving creates the next
              revision — never overwrites. Target a role with a job description to get a
              requirement-by-requirement review and coverage score.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
