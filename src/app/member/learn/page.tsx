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
import {
  FOUNDATION_PATH_SLUG,
  nextPreparationArea,
  readyAreaCount,
  selectContinuePreparation,
} from "./learn-presenters";
import { PreparationPlanCard } from "./preparation-plan-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function HowPreparationWorks() {
  const steps = [
    ["Choose", "Select a foundation or recruitment stage."],
    ["Prepare", "Work through focused activities in any order."],
    ["Continue", "Return to the next area that needs attention."],
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
  const foundational = paths.find((path) => path.slug === FOUNDATION_PATH_SLUG);
  const stagePaths = paths.filter((path) => path.slug !== FOUNDATION_PATH_SLUG);
  const alternativeStagePaths = stagePaths.filter((path) => path.id !== continuedPath?.id);

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
        <section
          aria-labelledby="current-preparation"
          className="learn-section current-preparation"
        >
          <p className="eyebrow">Current preparation</p>
          <article className="card continue-card">
            <div>
              <h2 id="current-preparation">{continuedPath.title}</h2>
              <div className="current-next">
                {nextArea && (
                  <p>
                    <span>Next area</span>
                    <strong>{nextArea.heading}</strong>
                  </p>
                )}
                <p>
                  <span>Next activity</span>
                  <strong>{nextResource.title}</strong>
                </p>
              </div>
              <p className="path-card-summary">
                {readyAreaCount(continuedPath)} of {continuedPath.sections.length} preparation areas
                ready · {continuedPath.completedCount} of {continuedPath.totalCount} resources
                complete
              </p>
              {continuedPath.progress > 0 && (
                <progress
                  aria-label={`${continuedPath.title}: ${continuedPath.progress}% complete`}
                  max="100"
                  value={continuedPath.progress}
                />
              )}
            </div>
            <div className="form-actions">
              <Link
                className="button-link"
                href={`/member/learn/${nextResource.slug}?path=${continuedPath.slug}`}
              >
                Continue preparation
              </Link>
              <Link href={`/member/learn/paths/${continuedPath.slug}`}>View plan</Link>
            </div>
          </article>
        </section>
      ) : allFollowedComplete ? (
        <section
          aria-labelledby="preparation-complete"
          className="learn-section card completion-card"
        >
          <p className="eyebrow">Your progress</p>
          <h2 id="preparation-complete">Current preparation is ready</h2>
          <p>Review a completed plan or choose another stage to prepare for.</p>
          <div className="form-actions">
            <Link className="button-link" href={`/member/learn/paths/${followedPaths[0]!.slug}`}>
              Review a completed plan
            </Link>
            <Link href="/member/learn/paths">Explore other Preparation Plans</Link>
          </div>
        </section>
      ) : (
        <section aria-labelledby="start-preparation" className="learn-section">
          <p className="eyebrow">Choose your focus</p>
          <h2 id="start-preparation">What are you preparing for?</h2>
          <p>
            Choose the recruitment stage you are currently facing. You will see the full preparation
            structure and what to do next.
          </p>
          {!stagePaths.length && (
            <article className="card empty-state">
              <h3>Preparation Plans are not available yet.</h3>
              <p>Browse focused resources while new plans are being prepared.</p>
            </article>
          )}
        </section>
      )}

      {alternativeStagePaths.length > 0 && (
        <section aria-labelledby="stage-plans" className="learn-section grouped-plans">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recruitment-stage plans</p>
              <h2 id="stage-plans">Prepare by recruitment stage</h2>
            </div>
            <Link href="/member/learn/paths">View all plans</Link>
          </div>
          <div className="path-grid overview-path-grid">
            {alternativeStagePaths.map((path) => (
              <PreparationPlanCard key={path.id} path={path} />
            ))}
          </div>
        </section>
      )}

      {foundational && foundational.id !== continuedPath?.id && (
        <section aria-labelledby="interview-foundations" className="learn-section grouped-plans">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Foundational preparation</p>
              <h2 id="interview-foundations">Build your interview foundations</h2>
            </div>
          </div>
          <div className="path-grid overview-path-grid">
            <PreparationPlanCard path={foundational} />
          </div>
        </section>
      )}

      <HowPreparationWorks />

      <section aria-labelledby="explore-resources" className="card explore-resources">
        <div>
          <h2 id="explore-resources">Looking for something specific?</h2>
          <p>Browse focused guides, exercises and checklists.</p>
        </div>
        <Link className="button-link" href="/member/learn/resources">
          Browse resources
        </Link>
      </section>
    </main>
  );
}
