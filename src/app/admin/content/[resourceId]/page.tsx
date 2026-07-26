import { notFound, redirect } from "next/navigation";
import { ResourceContent } from "../../../components/resource-content";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import {
  findAdminResource,
  listAdminResources,
  listCategories,
  listTags,
} from "../../../../modules/preparation-resources/application/admin-content";
import { ContentFields } from "../content-fields";
import { runResourceMutationAction } from "../action-boundary";
import { ConflictAlert } from "../conflict-alert";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resourceId: string }>;
  searchParams: Promise<{ preview?: string; error?: string; status?: string }>;
}) {
  const admin = await requireAdministrator();
  const id = (await params).resourceId;
  const [r, categories, tags, resources] = await Promise.all([
    findAdminResource(admin.userId, id),
    listCategories(admin.userId, true),
    listTags(admin.userId, true),
    listAdminResources(admin.userId),
  ]);
  if (!r) notFound();
  const query = await searchParams;
  async function save(form: FormData) {
    "use server";
    const result = await runResourceMutationAction(id, form);
    redirect(
      result.outcome === "conflict"
        ? "/admin/content?error=conflict"
        : result.outcome === "validation"
          ? `/admin/content/${id}?error=validation`
          : `/admin/content/${id}?status=${result.outcome}`,
    );
  }
  const previewResource = {
    ...r,
    categoryName: categories.find((c) => c.id === r.primaryCategoryId)?.name ?? "Uncategorised",
    completedAt: null,
    savedAt: null,
    resourceKey: "preview",
    relatedResources: resources
      .filter((item) => r.relatedResourceIds.includes(item.id))
      .map((item) => ({ accessLevel: item.accessLevel, slug: item.slug, title: item.title })),
    stages: [],
  } as const;
  return (
    <main className="cms-page cms-editor-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Content editor · {r.publicationState}</p>
          <h1>{r.title || "Untitled content"}</h1>
          <p>
            Version {r.version} · /{r.slug}
          </p>
        </div>
      </header>
      {query.error === "conflict" ? (
        <ConflictAlert reloadHref="?" />
      ) : query.error ? (
        <div className="error-summary" role="alert">
          Check the content fields and try again.
        </div>
      ) : null}
      {query.status && (
        <p role="status">
          {query.status === "unchanged" ? "No changes were needed." : "Resource updated."}
        </p>
      )}
      <form action={save} className="application-form cms-resource-form">
        <input name="expectedVersion" type="hidden" value={r.version} />
        <ContentFields categories={categories} resource={r} resources={resources} tags={tags} />
        <div className="form-actions cms-sticky-actions">
          <span className={`cms-status cms-status-${r.publicationState}`}>
            {r.publicationState}
          </span>
          <div className="cms-sticky-action-buttons">
            {r.publicationState !== "archived" && (
              <button name="intent" value="save">
                Save {r.publicationState === "published" ? "changes" : "draft"}
              </button>
            )}
            {r.publicationState === "draft" && (
              <button name="intent" value="publish">
                Publish
              </button>
            )}
            {r.publicationState === "published" && (
              <button className="button-secondary" name="intent" value="unpublish">
                Unpublish
              </button>
            )}
            {r.publicationState !== "archived" && (
              <button className="button-secondary" name="intent" value="archive">
                Archive
              </button>
            )}
            {r.publicationState === "archived" && (
              <button className="button-secondary" name="intent" value="restore">
                Restore to draft
              </button>
            )}
          </div>
        </div>
      </form>
      <details className="cms-preview">
        <summary>Preview member view</summary>
        <div className="cms-preview-body">
          <ResourceContent resource={previewResource} />
        </div>
      </details>
    </main>
  );
}
