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
    <main>
      <p className="eyebrow">Administrator CMS · {r.publicationState}</p>
      <h1>Edit resource</h1>
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
      <form action={save} className="application-form">
        <input name="expectedVersion" type="hidden" value={r.version} />
        <ContentFields categories={categories} resource={r} resources={resources} tags={tags} />
        <div className="form-actions">
          <button name="intent" value="save">
            Save
          </button>
          <button name="intent" value="publish">
            Publish
          </button>
          <button name="intent" value="unpublish">
            Unpublish
          </button>
          <button name="intent" value="archive">
            Archive
          </button>
          <button name="intent" value="restore">
            Restore to draft
          </button>
        </div>
      </form>
      <h2>Private preview</h2>
      <ResourceContent resource={previewResource} />
    </main>
  );
}
