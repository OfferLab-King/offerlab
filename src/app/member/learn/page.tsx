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
import { nextPreparationArea, readyAreaCount, selectContinuePreparation } from "./learn-presenters";
import { PreparationPlanCard } from "./preparation-plan-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function HowPreparationWorks() {
  const steps = [
    ["Choose a stage", "Select the recruitment stage you are currently facing."],
    ["Cover every preparation area", "See the complete preparation structure, not isolated tips."],
    ["Use focused activities", "Work through guides, exercises and checklists."],
    ["Track what is ready", "Return to see exactly what still needs attention."],
  ];
  return (
    <section aria-labelledby="how-preparation-works" className="learn-section">
      <h2 id="how-preparation-works">How preparation works</h2>
      <ol className="preparation-steps">
        {steps.map(([title, description]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function LearnPage() {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const paths = await readLearningPaths(auth.userId);
  const continuedPath = selectContinuePreparation(paths);
  const nextResource = continuedPath ? continueItem(continuedPath) : null;
  const nextArea = continuedPath ? nextPreparationArea(continuedPath) : null;
  const followedPaths = paths.filter((path) => path.following);
  const allFollowedComplete =
    followedPaths.length > 0 && followedPaths.every((path) => path.progress === 100);
  const foundational = paths.find((path) => path.slug === "build-your-interview-answer-bank");
  const stagePaths = paths.filter((path) => path.id !== foundational?.id);

  return (
    <main className="applications-shell learn-overview">
      <MemberApplicationsHeader />
      <LearnNavigation active="overview" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Learn</p>
          <h1>Prepare for every stage</h1>
          <p className="intro">
            Choose what you are preparing for, cover every important area, and return to the exact
            next step.
          </p>
        </div>
      </section>

      {continuedPath && nextResource ? (
        <section aria-labelledby="continue-preparation" className="learn-section">
          <p className="eyebrow">Your next step</p>
          <h2 id="continue-preparation">Continue your preparation</h2>
          <article className="card continue-card">
            <div>
              <h3>{continuedPath.title}</h3>
              <progress
                aria-label={`${continuedPath.title}: ${continuedPath.progress}% complete`}
                max="100"
                value={continuedPath.progress}
              />
              <p>
                {readyAreaCount(continuedPath)} of {continuedPath.sections.length} preparation areas
                ready · {continuedPath.completedCount} of {continuedPath.totalCount} resources
                complete
              </p>
              {nextArea && (
                <p>
                  <strong>Next area:</strong> {nextArea.heading}
                </p>
              )}
              <p>
                <strong>Next resource:</strong> {nextResource.title}
              </p>
            </div>
            <div className="form-actions">
              <Link
                className="button-link"
                href={`/member/learn/${nextResource.slug}?path=${continuedPath.slug}`}
              >
                Continue Preparation
              </Link>
              <Link href={`/member/learn/paths/${continuedPath.slug}`}>View Full Plan</Link>
            </div>
          </article>
        </section>
      ) : allFollowedComplete ? (
        <section
          aria-labelledby="preparation-complete"
          className="learn-section card completion-card"
        >
          <p className="eyebrow">Your progress</p>
          <h2 id="preparation-complete">Preparation complete</h2>
          <p>Review a completed plan or choose another stage to prepare for.</p>
          <div className="form-actions">
            <Link className="button-link" href={`/member/learn/paths/${followedPaths[0]!.slug}`}>
              Review a completed plan
            </Link>
            <Link href="/member/learn/paths">Explore Other Preparation Plans</Link>
          </div>
        </section>
      ) : (
        <section aria-labelledby="start-preparation" className="learn-section">
          <p className="eyebrow">Start your preparation</p>
          <h2 id="start-preparation">What are you preparing for?</h2>
          <p>
            Choose the recruitment stage you are currently facing. You will see the full preparation
            structure and what to do next.
          </p>
          {stagePaths.length ? (
            <div className="path-grid stage-chooser">
              {stagePaths.map((path) => (
                <PreparationPlanCard key={path.id} path={path} />
              ))}
            </div>
          ) : (
            <article className="card empty-state">
              <h3>Preparation Plans are not available yet.</h3>
              <p>Browse focused resources while new plans are being prepared.</p>
            </article>
          )}
        </section>
      )}

      {continuedPath && (
        <section aria-labelledby="other-plans" className="learn-section">
          <div className="section-heading">
            <h2 id="other-plans">Other Preparation Plans</h2>
            <Link href="/member/learn/paths">View all plans</Link>
          </div>
          <div className="path-grid overview-path-grid">
            {paths
              .filter((path) => path.id !== continuedPath.id)
              .slice(0, 3)
              .map((path) => (
                <PreparationPlanCard key={path.id} path={path} />
              ))}
          </div>
        </section>
      )}

      <HowPreparationWorks />

      {!continuedPath && foundational && (
        <section aria-labelledby="core-interview-preparation" className="learn-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Foundational preparation</p>
              <h2 id="core-interview-preparation">Build core interview preparation</h2>
            </div>
          </div>
          <div className="path-grid overview-path-grid">
            <PreparationPlanCard path={foundational} />
          </div>
        </section>
      )}

      <section aria-labelledby="explore-resources" className="card explore-resources">
        <div>
          <p className="eyebrow">Supporting activities</p>
          <h2 id="explore-resources">Browse supporting resources</h2>
          <p>Use focused guides, exercises and checklists alongside your complete plan.</p>
        </div>
        <Link className="button-link" href="/member/learn/resources">
          Browse Resources
        </Link>
      </section>
    </main>
  );
}
