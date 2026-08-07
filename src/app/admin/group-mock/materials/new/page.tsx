import Link from "next/link";

import { requireAdministrator } from "../../../../../modules/identity-access/application/authorization";
import { createGroupMockMaterialAction } from "../../actions";
import { MaterialEditor } from "../../editors";
import { materialValidationMessage } from "../material-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewGroupMockMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ fields?: string; result?: string }>;
}) {
  await requireAdministrator();
  const query = await searchParams;
  return (
    <main className="cms-page group-mock-material-editor-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Group Mock library</p>
          <h1>Create a case</h1>
          <p>
            Use only the sections the exercise needs. The flexible Markdown pack supports narrative
            briefs, tables, options, datasets and role notes.
          </p>
        </div>
        <Link className="button-secondary button-link" href="/admin/group-mock#materials">
          Back to library
        </Link>
      </header>
      {query.result === "invalid-material" && (
        <p className="error-summary" role="alert">
          The case was not saved. Check: {materialValidationMessage(query.fields)}.
        </p>
      )}
      <MaterialEditor action={createGroupMockMaterialAction} />
    </main>
  );
}
