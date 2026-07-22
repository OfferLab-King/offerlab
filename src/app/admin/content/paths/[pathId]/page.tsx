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
    <main>
      <p className="eyebrow">Administrator CMS · {path.publicationState}</p>
      <h1>Edit learning path</h1>
      {query.error === "conflict" && (
        <ConflictAlert reloadHref={`/admin/content/paths/${id}`} />
      )}{" "}
      {query.error === "validation" && (
        <div className="error-summary" role="alert">
          The path could not be saved. Check all fields and publication requirements.
        </div>
      )}
      {query.status && (
        <p className="status" role="status">
          {query.status === "unchanged" ? "No changes to save." : "Learning path saved."}
        </p>
      )}
      <p>
        <a href={`/admin/content/paths/${id}/preview`} target="_blank" rel="noreferrer">
          Preview path
        </a>
      </p>
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
