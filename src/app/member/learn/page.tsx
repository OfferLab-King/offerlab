import Link from "next/link";
import { redirect } from "next/navigation";
import {
  continueItem,
  readLearningPaths,
} from "../../../modules/learning-paths/application/learning-paths";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import { MemberApplicationsHeader } from "../applications/member-applications-header";
import { LearnNavigation } from "./learn-navigation";
import { planAction, selectContinuePreparation } from "./learn-presenters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const paths = await readLearningPaths(auth.userId);
  const continuedPath = selectContinuePreparation(paths);
  const nextResource = continuedPath ? continueItem(continuedPath) : null;
  const followedPaths = paths.filter((path) => path.following);
  const allFollowedComplete =
    followedPaths.length > 0 && followedPaths.every((path) => path.progress === 100);

  return (
    <main className="applications-shell learn-overview">
      <MemberApplicationsHeader />
      <LearnNavigation active="overview" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Learn</p>
          <h1>Prepare for every stage</h1>
          <p className="intro">
            Follow a clear preparation plan, continue where you stopped, and use focused resources
            when you need them.
          </p>
        </div>
      </section>

      <section aria-labelledby="continue-preparation" className="learn-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your next step</p>
            <h2 id="continue-preparation">Continue preparation</h2>
          </div>
        </div>
        {continuedPath && nextResource ? (
          <article className="card continue-card">
            <div>
              <p className="eyebrow">{continuedPath.categoryName ?? "Preparation plan"}</p>
              <h3>{continuedPath.title}</h3>
              <p>{continuedPath.shortDescription}</p>
              <progress
                aria-label={`${continuedPath.title}: ${continuedPath.progress}% complete`}
                max="100"
                value={continuedPath.progress}
              />
              <p>
                {continuedPath.completedCount} of {continuedPath.totalCount} resources complete ·{" "}
                {continuedPath.progress}%
              </p>
              <p>
                <strong>Next:</strong> {nextResource.title}
              </p>
            </div>
            <div className="form-actions">
              <Link
                className="button-link"
                href={`/member/learn/${nextResource.slug}?path=${continuedPath.slug}`}
              >
                Continue Preparation
              </Link>
              <Link href={`/member/learn/paths/${continuedPath.slug}`}>View full plan</Link>
            </div>
          </article>
        ) : (
          <article className="card empty-state">
            <h3>
              {allFollowedComplete
                ? "Your followed plans are complete"
                : "Choose a Preparation Plan"}
            </h3>
            <p>
              {allFollowedComplete
                ? "Review a completed plan or choose another stage to prepare for."
                : "Start with the recruitment stage you are preparing for."}
            </p>
            <Link className="button-link" href="/member/learn/paths">
              {allFollowedComplete ? "Review plans" : "View Preparation Plans"}
            </Link>
          </article>
        )}
      </section>

      <section aria-labelledby="prepare-by-stage" className="learn-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Structured preparation</p>
            <h2 id="prepare-by-stage">Prepare by stage</h2>
          </div>
          <Link href="/member/learn/paths">View all Preparation Plans</Link>
        </div>
        {paths.length ? (
          <div className="path-grid overview-path-grid">
            {paths.map((path) => (
              <article className="card path-card" key={path.id}>
                <p className="eyebrow">{path.categoryName ?? "Preparation outcome"}</p>
                <h3>{path.title}</h3>
                <p>{path.shortDescription}</p>
                <p>
                  {path.sections.length} preparation areas · {path.totalCount} resources
                </p>
                <progress
                  aria-label={`${path.title}: ${path.progress}% complete`}
                  max="100"
                  value={path.progress}
                />
                <p>
                  {path.progress === 100
                    ? "Complete"
                    : path.completedCount > 0
                      ? `${path.completedCount} of ${path.totalCount} complete · In progress`
                      : "Not started"}
                </p>
                <Link className="button-link" href={`/member/learn/paths/${path.slug}`}>
                  {planAction(path)}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <article className="card empty-state">
            <h3>Preparation Plans are not currently available</h3>
            <p>Use the Resource Library for focused preparation material in the meantime.</p>
          </article>
        )}
      </section>

      <section aria-labelledby="explore-resources" className="card explore-resources">
        <div>
          <p className="eyebrow">Supporting material</p>
          <h2 id="explore-resources">Explore resources</h2>
          <p>Browse guides, exercises, checklists and videos for specific preparation needs.</p>
        </div>
        <Link className="button-link" href="/member/learn/resources">
          Browse Resources
        </Link>
      </section>
    </main>
  );
}
