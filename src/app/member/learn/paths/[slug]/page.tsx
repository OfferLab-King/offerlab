import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../../modules/member-profile/application/onboarding";
import {
  continueItem,
  readLearningPath,
} from "../../../../../modules/learning-paths/application/learning-paths";
import { MarkdownContent } from "../../../../components/resource-content";
import { PathFollowControls } from "../path-follow-controls";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  void searchParams;
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const path = await readLearningPath(auth.userId, (await params).slug);
  if (!path) notFound();
  const next = continueItem(path);
  return (
    <main className="applications-shell path-detail">
      <Link href="/member/learn/paths">← All learning paths</Link>
      <p className="eyebrow">{path.categoryName ?? "Learning path"}</p>
      <h1>{path.title}</h1>
      <p className="intro">{path.shortDescription}</p>
      <p>Recommended order, not a requirement. You can open any resource at any time.</p>
      <progress aria-label={`${path.progress}% complete`} max="100" value={path.progress} />
      <p>
        {path.completedCount} of {path.totalCount} complete · {path.progress}%
      </p>
      <div className="form-actions">
        {next ? (
          <Link className="button-link" href={`/member/learn/${next.slug}?path=${path.slug}`}>
            Continue learning
          </Link>
        ) : (
          <p className="status">Path complete — revisit any resource below.</p>
        )}
        <PathFollowControls following={path.following} pathId={path.id} />
      </div>
      {path.introduction && (
        <div className="card">
          <MarkdownContent markdown={path.introduction} />
        </div>
      )}
      {path.sections.map((section, index) => (
        <section className="path-section" key={section.id} aria-labelledby={`section-${index}`}>
          <h2 id={`section-${index}`}>{section.heading}</h2>
          {section.description && <p>{section.description}</p>}
          <ol className="path-items">
            {section.items.map((item) => (
              <li className="card" key={item.id}>
                <div>
                  <p className="eyebrow">
                    {item.resourceType}
                    {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
                  </p>
                  <h3>{item.title}</h3>
                  {item.contextNote && <p>{item.contextNote}</p>}
                  <p>{item.completedAt ? "✓ Completed" : "Not completed"}</p>
                </div>
                <Link href={`/member/learn/${item.slug}?path=${path.slug}`}>Open resource</Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
