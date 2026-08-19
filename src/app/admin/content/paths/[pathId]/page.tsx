import { notFound } from "next/navigation";
import { requireAdministrator } from "../../../../../modules/identity-access/application/authorization";
import {
  readAdminPath,
  readPathEditorOptions,
} from "../../../../../modules/learning-paths/application/admin-learning-paths";
import { ConflictAlert } from "../../conflict-alert";
import { updatePathAction } from "../actions";
import { PathEditor } from "../path-editor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ pathId: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const admin = await requireAdministrator();
  const id = (await params).pathId;
  const [path, options] = await Promise.all([
    readAdminPath(admin.userId, id),
    readPathEditorOptions(admin.userId),
  ]);
  if (!path) notFound();
  const query = await searchParams;
  return (
    <main className="cms-editor-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Preparation paths · {path.publicationState}</p>
          <h1>{path.title || "Untitled learning path"}</h1>
          <p>Update the sequence, context and publication state.</p>
        </div>
        <a
          className="button-secondary button-link"
          href={`/admin/content/paths/${id}/preview`}
          target="_blank"
          rel="noreferrer"
        >
          Preview path
        </a>
      </header>
      {query.error === "conflict" && <ConflictAlert reloadHref={`/admin/content/paths/${id}`} />}{" "}
      {query.error && query.error !== "conflict" && (
        <div className="error-summary" role="alert">
          {query.error === "validation"
            ? "The path could not be saved. Check all fields and publication requirements."
            : decodeURIComponent(query.error)}
        </div>
      )}
      {query.status && (
        <p className="status" role="status">
          {query.status === "unchanged" ? "No changes to save." : "Learning path saved."}
        </p>
      )}
      <PathEditor
        action={updatePathAction.bind(null, id)}
        categories={options.categories}
        initial={path}
        publicationState={path.publicationState}
        resources={options.resources}
        version={path.version}
      />
    </main>
  );
}
