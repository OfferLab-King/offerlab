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
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Organisation</p>
          <h1>Content tags</h1>
          <p>Add precise labels that help people find related content.</p>
        </div>
      </header>
      {status === "conflict" ? (
        <ConflictAlert reloadHref="/admin/content/tags" />
      ) : status ? (
        <p role="status">Outcome: {status}</p>
      ) : null}
      <div className="cms-taxonomy-layout">
        <form action={create} className="application-form cms-editor-card cms-taxonomy-create">
          <div className="cms-section-heading">
            <div>
              <p className="eyebrow">New</p>
              <h2>Create tag</h2>
            </div>
          </div>
          <label>
            Name
            <input name="name" required maxLength={60} />
          </label>
          <label>
            Slug
            <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} />
          </label>
          <button>Create tag</button>
        </form>
        <section className="cms-taxonomy-list" aria-label="Existing tags">
          <div className="cms-section-heading">
            <div>
              <h2>Existing tags</h2>
              <p>{rows.length} total · names are case-insensitive.</p>
            </div>
          </div>
          {rows.map((row) => (
            <form action={update} className="application-form cms-taxonomy-row" key={row.id}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="version" value={row.version} />
              <div className="cms-content-badges">
                <code>{row.slug}</code>
                <span
                  className={`cms-status cms-status-${row.archivedAt ? "archived" : "published"}`}
                >
                  {row.archivedAt ? "archived" : "active"}
                </span>
              </div>
              <label>
                Name
                <input name="name" defaultValue={row.name} required maxLength={60} />
              </label>
              <div className="form-actions">
                <button name="intent" value="save">
                  Save
                </button>
                <button
                  className="button-secondary"
                  name="intent"
                  value={row.archivedAt ? "restore" : "archive"}
                >
                  {row.archivedAt ? "Restore" : "Archive"}
                </button>
              </div>
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}
