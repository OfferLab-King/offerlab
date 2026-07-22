import Link from "next/link";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { listAdminResources } from "../../../modules/preparation-resources/application/admin-content";
import { ConflictAlert } from "./conflict-alert";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await requireAdministrator();
  const resources = await listAdminResources(admin.userId);
  const error = (await searchParams).error;
  return (
    <main>
      <p className="eyebrow">Administrator CMS</p>
      <h1>Content</h1>
      {error === "conflict" && <ConflictAlert reloadHref="/admin/content" />}
      <nav>
        <Link href="/admin">Admin home</Link> ·{" "}
        <Link href="/admin/content/new">Create resource</Link> ·{" "}
        <Link href="/admin/content/categories">Categories</Link> ·{" "}
        <Link href="/admin/content/tags">Tags</Link>
        {" · "}
        <Link href="/admin/content/paths">Learning paths</Link>
      </nav>
      <div className="resource-grid">
        {resources.map((r) => (
          <article className="card" key={r.id}>
            <h2>{r.title}</h2>
            <p>
              {r.publicationState} · {r.accessLevel} · {r.resourceType}
            </p>
            <Link href={`/admin/content/${r.id}`}>Edit</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
