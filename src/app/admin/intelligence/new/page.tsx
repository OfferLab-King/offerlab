import Link from "next/link";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import { createIntelligenceAction } from "../actions";
import { IntelligenceEditor } from "../intelligence-editor";

export const runtime = "nodejs";

export default async function NewIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdministrator();
  const query = await searchParams;
  return (
    <main className="cms-editor-page">
      <div className="cms-editor-backlink">
        <Link href="/admin/intelligence">← Experience reports</Link>
      </div>
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Coach-curated intelligence</p>
          <h1>Create an experience report</h1>
          <p>Turn authorised, anonymised candidate feedback into a structured moderated report.</p>
        </div>
      </header>
      {query.result === "invalid" && (
        <p className="error-summary">Complete every required field and confirm confidentiality.</p>
      )}
      <IntelligenceEditor action={createIntelligenceAction} />
    </main>
  );
}
