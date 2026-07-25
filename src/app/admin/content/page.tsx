import Link from "next/link";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { listAdminResources } from "../../../modules/preparation-resources/application/admin-content";
import { ConflictAlert } from "./conflict-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; state?: string; type?: string }>;
}) {
  const admin = await requireAdministrator();
  const all = await listAdminResources(admin.userId);
  const query = await searchParams;
  const search = (query.q ?? "").trim().toLocaleLowerCase("en-GB");
  const resources = all.filter(
    (resource) =>
      (!search ||
        `${resource.title} ${resource.shortDescription} ${resource.slug}`
          .toLocaleLowerCase("en-GB")
          .includes(search)) &&
      (!query.state || resource.publicationState === query.state) &&
      (!query.type || resource.resourceType === query.type),
  );
  const count = (state: AdminResourceState) =>
    all.filter((resource) => resource.publicationState === state).length;
  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Content library</p>
          <h1>Content</h1>
          <p>Draft, publish and maintain the resources members see across OfferLab.</p>
        </div>
        <Link className="button-link" href="/admin/content/new">
          Create content
        </Link>
      </header>
      {query.error === "conflict" && <ConflictAlert reloadHref="/admin/content" />}
      <section className="cms-summary-grid" aria-label="Content summary">
        <div>
          <strong>{all.length}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{count("published")}</strong>
          <span>Published</span>
        </div>
        <div>
          <strong>{count("draft")}</strong>
          <span>Drafts</span>
        </div>
        <div>
          <strong>{count("archived")}</strong>
          <span>Archived</span>
        </div>
      </section>
      <form className="cms-filter-bar">
        <label>
          <span>Search content</span>
          <input
            defaultValue={query.q ?? ""}
            name="q"
            placeholder="Search by title, summary or slug"
          />
        </label>
        <label>
          <span>Status</span>
          <select defaultValue={query.state ?? ""} name="state">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span>Type</span>
          <select defaultValue={query.type ?? ""} name="type">
            <option value="">All types</option>
            <option value="coaching_case">Coaching cases</option>
            <option value="guide">Guides</option>
            <option value="checklist">Checklists</option>
            <option value="template">Templates</option>
            <option value="video">Videos</option>
            <option value="exercise">Exercises</option>
            <option value="article">Articles</option>
          </select>
        </label>
        <button>Apply filters</button>
        {(search || query.state || query.type) && <Link href="/admin/content">Clear</Link>}
      </form>
      <div className="cms-content-list">
        {resources.length ? (
          resources.map((resource) => (
            <article className="card cms-content-row" key={resource.id}>
              <div className="cms-content-row-main">
                <div className="cms-content-badges">
                  <span className={`cms-status cms-status-${resource.publicationState}`}>
                    {resource.publicationState}
                  </span>
                  <span>
                    {resource.resourceType === "coaching_case"
                      ? "coaching case"
                      : resource.resourceType}
                  </span>
                  <span>{resource.accessLevel}</span>
                </div>
                <h2>{resource.title || "Untitled content"}</h2>
                <p>{resource.shortDescription || "No summary yet."}</p>
                <small>
                  /{resource.slug} · version {resource.version}
                </small>
              </div>
              <div className="cms-row-actions">
                <Link
                  className="button-secondary button-link"
                  href={`/admin/content/${resource.id}`}
                >
                  Edit
                </Link>
                {resource.publicationState === "published" && (
                  <Link
                    href={
                      `${resource.accessLevel === "member" ? "/member" : ""}/learn/${resource.slug}` as never
                    }
                  >
                    View
                  </Link>
                )}
              </div>
            </article>
          ))
        ) : (
          <section className="cms-empty-state">
            <h2>No content matches these filters</h2>
            <p>Clear the filters or create a new resource.</p>
          </section>
        )}
      </div>
    </main>
  );
}

type AdminResourceState = "archived" | "draft" | "published";
