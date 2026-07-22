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
    <main>
      <p className="eyebrow">Administrator CMS</p>
      <h1>Learning paths</h1>
      <nav>
        <Link href="/admin/content">Content</Link> ·{" "}
        <Link href="/admin/content/paths/new">Create path</Link>
      </nav>
      <form className="path-filter">
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
      <div className="path-grid">
        {paths.map((path) => (
          <article className="card" key={path.id}>
            <p className="eyebrow">{path.publicationState}</p>
            <h2>{path.title || "Untitled path"}</h2>
            <p>
              /{path.slug} · version {path.version}
            </p>
            <Link href={`/admin/content/paths/${path.id}`}>Edit path</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
