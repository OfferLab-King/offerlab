import { notFound } from "next/navigation";
import Link from "next/link";

import { requireAdministrator } from "../../../../../modules/identity-access/application/authorization";
import { readGroupMockMaterialAdmin } from "../../../../../modules/practice-services/application/group-mock";
import { updateGroupMockMaterialAction } from "../../actions";
import { MaterialEditor } from "../../editors";
import { materialValidationMessage } from "../material-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditGroupMockMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ materialId: string }>;
  searchParams: Promise<{ fields?: string; result?: string }>;
}) {
  const administrator = await requireAdministrator();
  const [{ materialId }, query] = await Promise.all([params, searchParams]);
  const material = await readGroupMockMaterialAdmin(administrator.userId, materialId);
  if (!material) notFound();
  return (
    <main className="cms-page group-mock-material-editor-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Group Mock case editor · {material.publication_state}</p>
          <h1>{material.title}</h1>
          <p>
            Edit the same structured case that members see. Saving updates the published member view
            immediately.
          </p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary button-link" href="/admin/group-mock#materials">
            Back to library
          </Link>
          <Link
            className="button-secondary button-link"
            href={`/member/learn/practice/cases/${material.id}`}
          >
            Member preview
          </Link>
        </div>
      </header>
      {query.result === "material-saved" && (
        <p className="success-summary" role="status">
          Case saved.
        </p>
      )}
      {query.result === "invalid-material" && (
        <p className="error-summary" role="alert">
          The case was not saved. Check: {materialValidationMessage(query.fields)}.
        </p>
      )}
      <MaterialEditor action={updateGroupMockMaterialAction} material={material} />
    </main>
  );
}
