import { redirect } from "next/navigation";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import { listTags } from "../../../../modules/preparation-resources/application/admin-content";
import { runCreateTaxonomyAction, runUpdateTaxonomyAction } from "../action-boundary";
import { ConflictAlert } from "../conflict-alert";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const administrator = await requireAdministrator();
  const rows = await listTags(administrator.userId, true);
  const status = (await searchParams).status;
  async function create(form: FormData) {
    "use server";
    const result = await runCreateTaxonomyAction("tag", form);
    redirect(`/admin/content/tags?status=${result.outcome}`);
  }
  async function update(form: FormData) {
    "use server";
    const result = await runUpdateTaxonomyAction("tag", form);
    redirect(`/admin/content/tags?status=${result.outcome}`);
  }
  return (
    <main>
      <h1>Content tags</h1>
      <p>Stable slugs; case-insensitive names; archive and restore only.</p>
      {status === "conflict" ? (
        <ConflictAlert reloadHref="/admin/content/tags" />
      ) : status ? (
        <p role="status">Outcome: {status}</p>
      ) : null}
      <form action={create} className="application-form">
        <h2>Create tag</h2>
        <label>
          Name
          <input name="name" required maxLength={60} />
        </label>
        <label>
          Slug
          <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} />
        </label>
        <button>Create</button>
      </form>
      <div>
        {rows.map((row) => (
          <form action={update} className="application-form card" key={row.id}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="version" value={row.version} />
            <p>
              <strong>{row.slug}</strong>
              {row.archivedAt ? " · archived" : " · active"}
            </p>
            <label>
              Name
              <input name="name" defaultValue={row.name} required maxLength={60} />
            </label>
            <div className="form-actions">
              <button name="intent" value="save">
                Save
              </button>
              <button name="intent" value={row.archivedAt ? "restore" : "archive"}>
                {row.archivedAt ? "Restore" : "Archive"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </main>
  );
}
