import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdministrator } from "../../../../../../modules/identity-access/application/authorization";
import {
  readAdminPath,
  readPathEditorOptions,
} from "../../../../../../modules/learning-paths/application/admin-learning-paths";
import { MarkdownContent } from "../../../../../components/resource-content";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ pathId: string }> }) {
  const admin = await requireAdministrator();
  const id = (await params).pathId;
  const [path, options] = await Promise.all([
    readAdminPath(admin.userId, id),
    readPathEditorOptions(admin.userId),
  ]);
  if (!path) notFound();
  const resources = new Map(options.resources.map((resource) => [resource.id, resource]));
  return (
    <main className="applications-shell path-detail">
      <p className="eyebrow">Administrator preview · {path.publicationState}</p>
      <h1>{path.title || "Untitled learning path"}</h1>
      <p className="intro">{path.shortDescription || "No description yet."}</p>
      <Link href={`/admin/content/paths/${id}`}>← Back to editor</Link>
      {path.introduction && (
        <div className="card">
          <MarkdownContent markdown={path.introduction} />
        </div>
      )}
      {path.sections.map((section, index) => (
        <section className="path-section" key={index}>
          <h2>{section.heading || `Untitled section ${index + 1}`}</h2>
          <p>{section.description}</p>
          <ol className="path-items">
            {section.items.map((item, itemIndex) => (
              <li className="card" key={`${item.resourceId}-${itemIndex}`}>
                <div>
                  <h3>{resources.get(item.resourceId)?.title || "Unavailable resource"}</h3>
                  <p>{item.contextNote}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
