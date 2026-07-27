import Link from "next/link";
import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import { readAdminPaths } from "../../../../modules/learning-paths/application/admin-learning-paths";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const admin = await requireAdministrator();
  const state = (await searchParams).state;
  const all = await readAdminPaths(admin.userId);
  const paths = state ? all.filter((path) => path.publicationState === state) : all;
  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Guided preparation</p>
          <h1>Preparation paths</h1>
          <p>Arrange published resources into clear, ordered preparation sequences.</p>
        </div>
        <Link className="button-link" href="/admin/content/paths/new">
          Create path
        </Link>
      </header>
      <form className="cms-filter-bar cms-path-filter">
        <label>
          Publication state
          <select defaultValue={state ?? ""} name="state">
            <option value="">All</option>
            <option>draft</option>
            <option>published</option>
            <option>archived</option>
          </select>
        </label>
        <button>Filter</button>
      </form>
      <div className="cms-content-list">
        {paths.map((path) => (
          <article className="cms-content-row" key={path.id}>
            <div className="cms-content-row-main">
              <div className="cms-content-badges">
                <span className={`cms-status cms-status-${path.publicationState}`}>
                  {path.publicationState}
                </span>
                <span>Version {path.version}</span>
              </div>
              <h2>{path.title || "Untitled path"}</h2>
              <p>/{path.slug}</p>
            </div>
            <div className="cms-row-actions">
              <Link
                className="button-secondary button-link"
                href={`/admin/content/paths/${path.id}`}
              >
                Edit path
              </Link>
            </div>
          </article>
        ))}
        {!paths.length && (
          <div className="cms-empty-state">
            <h2>No paths found</h2>
            <p>Try another filter or create the first path.</p>
          </div>
        )}
      </div>
    </main>
  );
}
