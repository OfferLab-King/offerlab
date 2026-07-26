import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import { readIntelligenceReportForAdmin } from "../../../../modules/recruitment-intelligence/application/reports";
import { updateIntelligenceAction } from "../actions";
import { IntelligenceEditor } from "../intelligence-editor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const administrator = await requireAdministrator();
  const [report, query] = await Promise.all([
    readIntelligenceReportForAdmin(administrator.userId, (await params).id),
    searchParams,
  ]);
  if (!report) notFound();
  return (
    <main className="cms-editor-page">
      <div className="cms-editor-backlink">
        <Link href="/admin/intelligence">← Experience reports</Link>
      </div>
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">{report.moderationState} report</p>
          <h1>{report.companyName}</h1>
          <p>
            {report.sourceKind === "member"
              ? "Edit only for clarity, confidentiality or usefulness without changing material meaning."
              : "Maintain this coach-curated report and its visible provenance."}
          </p>
        </div>
        {report.moderationState === "published" && (
          <Link href={`/intelligence/${report.slug}`}>View public preview</Link>
        )}
      </header>
      {query.result === "created" && (
        <p className="success-summary">Report created and ready for moderation.</p>
      )}
      {query.result === "saved" && <p className="success-summary">Report changes saved.</p>}
      {query.result === "error" && (
        <p className="error-summary">Reload and try that change again.</p>
      )}
      <IntelligenceEditor action={updateIntelligenceAction} report={report} />
    </main>
  );
}
