import Link from "next/link";
import type { CareerDocumentKind } from "../../modules/career-documents/domain/career-document";
import type { CareerDocument } from "../../modules/career-documents/infrastructure/career-repository";
import { CareerDocumentNavigation } from "./career-document-navigation";
import { CareerDocumentUploadForm } from "./career-document-upload-form";
import { MemberApplicationsHeader } from "./applications/member-applications-header";

export function CareerDocumentList({
  documents,
  kind,
}: {
  documents: readonly CareerDocument[];
  kind: CareerDocumentKind;
}) {
  const cv = kind === "cv";
  const singular = cv ? "CV" : "cover letter";
  const href = cv ? "/member/cvs" : "/member/cover-letters";
  return (
    <main className="applications-shell career-documents-shell">
      <MemberApplicationsHeader />
      <CareerDocumentNavigation active={kind} />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Application documents</p>
          <h1>{cv ? "CV workspace" : "Cover-letter workspace"}</h1>
          <p className="intro">
            {cv
              ? "Keep a strong base CV, then create a truthful targeted version for each role."
              : "Keep company- and role-specific letters separate from your reusable CV versions."}
          </p>
        </div>
      </section>
      <section aria-labelledby="upload-document" className="career-document-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Add a document</p>
            <h2 id="upload-document">Upload {cv ? "a CV" : "a cover letter"}</h2>
          </div>
        </div>
        <CareerDocumentUploadForm kind={kind} />
      </section>
      <section aria-labelledby="document-library" className="career-document-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Your private library</p>
            <h2 id="document-library">{cv ? "CVs" : "Cover letters"}</h2>
          </div>
          <span className="application-count">{documents.length} active</span>
        </div>
        {documents.length ? (
          <ul className="material-list">
            {documents.map((document) => (
              <li className="material-row" key={document.id}>
                <div>
                  <h3>{document.title}</h3>
                  <p>
                    {document.versionCount} version{document.versionCount === 1 ? "" : "s"}
                    {document.latestVersion?.targetRole && document.latestVersion.targetCompany
                      ? ` · Latest for ${document.latestVersion.targetRole} at ${document.latestVersion.targetCompany}`
                      : " · Base document"}
                  </p>
                  <p className="hint">
                    Updated{" "}
                    {document.updatedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </p>
                </div>
                <Link className="button-link button-secondary" href={`${href}/${document.id}`}>
                  Open {singular}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card empty-state">
            <h3>No {cv ? "CVs" : "cover letters"} yet</h3>
            <p>Upload a PDF or DOCX above. AI review never starts automatically.</p>
          </div>
        )}
      </section>
    </main>
  );
}
