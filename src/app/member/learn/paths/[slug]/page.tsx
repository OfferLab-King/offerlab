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
import { LearnNavigation } from "../../learn-navigation";
import {
  nextPreparationArea,
  planLabel,
  preparationAreaProgress,
  readyAreaCount,
  resourceAction,
} from "../../learn-presenters";
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
  const nextArea = nextPreparationArea(path);
  const progressText = `${readyAreaCount(path)} of ${path.sections.length} preparation areas ready · ${path.completedCount} of ${path.totalCount} activities complete`;
  return (
    <main className="applications-shell path-detail">
      <LearnNavigation active="paths" />
      <Link href="/member/learn/paths">← All Preparation Plans</Link>
      <header className="path-detail-header">
        <p className="eyebrow">{planLabel(path)}</p>
        <h1>{path.title}</h1>
        <p className="intro">{path.shortDescription}</p>
        <p className="path-card-summary">
          {path.sections.length} preparation areas · {path.totalCount} activities
        </p>
        <p>{progressText}</p>
        {path.progress > 0 && path.progress < 100 && (
          <progress aria-label={`${path.progress}% complete`} max="100" value={path.progress} />
        )}
        <div className="plan-primary-actions">
          {!path.following ? (
            <PathFollowControls following={false} pathId={path.id} />
          ) : next ? (
            <>
              <Link className="button-link" href={`/member/learn/${next.slug}?path=${path.slug}`}>
                Continue preparation
              </Link>
              <PathFollowControls following pathId={path.id} quiet />
            </>
          ) : (
            <>
              <Link className="button-link" href="#plan-areas">
                Review plan
              </Link>
              <PathFollowControls following pathId={path.id} quiet />
            </>
          )}
        </div>
      </header>
      {path.introduction && (
        <aside className="plan-introduction" aria-label="Plan introduction">
          <MarkdownContent markdown={path.introduction} />
        </aside>
      )}
      <div className="plan-layout" id="plan-areas">
        <nav aria-label="Preparation area outline" className="plan-outline desktop-plan-outline">
          <h2>Plan outline</h2>
          <ol>
            {path.sections.map((section, index) => {
              const area = preparationAreaProgress(section);
              const symbol =
                area.status === "Ready" ? "✓" : area.status === "In progress" ? "●" : "○";
              return (
                <li key={section.id}>
                  <a href={`#area-${index}`}>
                    <span aria-hidden="true">{symbol}</span> {section.heading}
                    <span className="visually-hidden"> — {area.status}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
        <details className="plan-outline mobile-plan-outline">
          <summary>Plan overview</summary>
          <ol>
            {path.sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#area-${index}`}>{section.heading}</a> —{" "}
                {preparationAreaProgress(section).status}
              </li>
            ))}
          </ol>
        </details>
        <div className="plan-areas">
          {path.sections.map((section, index) => {
            const area = preparationAreaProgress(section);
            const isCurrent = section.id === nextArea?.id;
            return (
              <details
                className="plan-area-disclosure"
                id={`area-${index}`}
                key={section.id}
                open={isCurrent || (!nextArea && index === 0)}
              >
                <summary>
                  <span className="area-summary-copy">
                    <strong>{section.heading}</strong>
                    <span>
                      {area.status} · {area.completedCount} of {area.totalCount} activities
                    </span>
                    {section.description && <span>{section.description}</span>}
                  </span>
                </summary>
                <ol className="path-items">
                  {section.items.map((item) => (
                    <li className="activity-row" key={item.id}>
                      <span className="activity-indicator" aria-hidden="true">
                        {item.completedAt ? "✓" : "○"}
                      </span>
                      <div className="activity-copy">
                        <p className="eyebrow">
                          {resourceTypeLabel(item.resourceType)}
                          {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
                        </p>
                        <h3>
                          <Link href={`/member/learn/${item.slug}?path=${path.slug}`}>
                            {item.title}
                          </Link>
                        </h3>
                        {item.contextNote && <p>{item.contextNote}</p>}
                        <span className="activity-status">
                          {item.completedAt ? "Completed" : "Not started"}
                        </span>
                      </div>
                      <Link
                        className="activity-action"
                        href={`/member/learn/${item.slug}?path=${path.slug}`}
                      >
                        {resourceAction(Boolean(item.completedAt))}
                      </Link>
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}
        </div>
      </div>
    </main>
  );
}
