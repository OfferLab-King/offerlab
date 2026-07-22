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
import { MemberApplicationsHeader } from "../../../applications/member-applications-header";
import { LearnNavigation } from "../../learn-navigation";
import { preparationAreaProgress, readyAreaCount, resourceAction } from "../../learn-presenters";
import { resourceTypeLabel } from "../../../../../modules/taxonomy/domain/display-labels";
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
      <MemberApplicationsHeader />
      <LearnNavigation active="paths" />
      <Link href="/member/learn/paths">← All Preparation Plans</Link>
      <p className="eyebrow">{path.categoryName ?? "Preparation Plan"}</p>
      <h1>{path.title}</h1>
      <p className="intro">{path.shortDescription}</p>
      <p>
        {path.sections.length} preparation areas · {path.totalCount} resources. The order is
        recommended, not locked, so you can open any resource at any time.
      </p>
      <progress aria-label={`${path.progress}% complete`} max="100" value={path.progress} />
      <p>
        <strong>
          {readyAreaCount(path)} of {path.sections.length} preparation areas ready
        </strong>
        <br />
        {path.completedCount} of {path.totalCount} activities completed
      </p>
      <div className="form-actions">
        {next ? (
          <Link className="button-link" href={`/member/learn/${next.slug}?path=${path.slug}`}>
            Continue Preparation
          </Link>
        ) : (
          <p className="status">Plan complete — review any resource below.</p>
        )}
        <PathFollowControls following={path.following} pathId={path.id} />
      </div>
      {path.introduction && (
        <div className="card">
          <MarkdownContent markdown={path.introduction} />
        </div>
      )}
      {path.sections.map((section, index) => {
        const area = preparationAreaProgress(section);
        return (
          <section className="path-section" key={section.id} aria-labelledby={`section-${index}`}>
            <div className="path-area-heading">
              <h2 id={`section-${index}`}>{section.heading}</h2>
              <span
                className={`area-status area-status-${area.status.toLowerCase().replace(" ", "-")}`}
              >
                {area.status}
              </span>
            </div>
            <p>
              <strong>
                {area.completedCount} of {area.totalCount} activities complete
              </strong>
            </p>
            {section.description && <p>{section.description}</p>}
            <ol className="path-items">
              {section.items.map((item) => (
                <li className="card" key={item.id}>
                  <div>
                    <p className="eyebrow">
                      {resourceTypeLabel(item.resourceType)}
                      {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
                    </p>
                    <h3>{item.title}</h3>
                    {item.contextNote && <p>{item.contextNote}</p>}
                    <p>{item.completedAt ? "✓ Completed" : "○ Not started"}</p>
                  </div>
                  <Link href={`/member/learn/${item.slug}?path=${path.slug}`}>
                    {resourceAction(Boolean(item.completedAt))}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
