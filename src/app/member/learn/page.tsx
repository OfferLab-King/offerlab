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
import { readAnswerBankSummary } from "../../../modules/answer-bank/application/answer-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const auth = await requireMember();
  if (!(await readOnboardingProfile(auth.userId))?.completedAt) redirect("/member/onboarding");
  const [paths, bank] = await Promise.all([
    readLearningPaths(auth.userId),
    readAnswerBankSummary(auth.userId),
  ]);
  const continuedPath = selectContinuePreparation(paths);
  const nextResource = continuedPath ? continueItem(continuedPath) : null;
  const nextArea = continuedPath ? nextPreparationArea(continuedPath) : null;
  const followedPaths = paths.filter((path) => path.following);
  const allFollowedComplete =
    followedPaths.length > 0 && followedPaths.every((path) => path.progress === 100);

  return (
    <main className="applications-shell learn-overview">
      <MemberApplicationsHeader />
      <LearnNavigation active="overview" />
      <section className="workspace-hero compact-hero">
        <div>
          <p className="eyebrow">Prepare</p>
          <h1>Library</h1>
          <p className="intro">
            Direct access to questions, cases, resources and intelligence — no required path.
          </p>
        </div>
        <Link className="button-link button-secondary" href="/member/learn/answer-bank">
          Open Answer Bank
        </Link>
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
          <p>Choose a Preparation Plan for the recruitment stage you are facing.</p>
          <Link className="button-link" href="/member/learn/paths">
            Choose a Preparation Plan
          </Link>
        </section>
      )}

      <section aria-labelledby="answer-story-bank" className="learn-section card">
        <div className="workspace-section-header">
          <div>
            <p className="eyebrow">Your evidence</p>
            <h2 id="answer-story-bank">Answer &amp; Story Bank</h2>
          </div>
          <Link className="button-link" href="/member/learn/answer-bank">
            Open
          </Link>
        </div>
        <p className="hint">
          {bank.stories} stories · {bank.readyAnswers} of 14 answers prepared ·{" "}
          {bank.competenciesCovered}/10 competencies
        </p>
        <p>
          <strong>Next:</strong> {bank.nextAction}
        </p>
      </section>

      <section aria-labelledby="explore-library" className="learn-section">
        <h2 id="explore-library">Explore the library</h2>
        <p className="hint">
          Two distinctive artefacts, then the full catalogue — all URL-backed and shareable.
        </p>
        <div className="distinctive-grid">
          <article
            className="distinctive-card"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            <p className="eyebrow" style={{ color: "var(--accent)" }}>
              Annotated coaching case
            </p>
            <h3>Before / after with reasoning</h3>
            <p>
              Original answer, coach questions, revision and why it’s stronger — not just the final
              answer.
            </p>
            <Link
              className="button-link button-secondary compact-button"
              href="/member/learn/cases"
            >
              Study a case
            </Link>
          </article>
          <article
            className="distinctive-card"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            <p className="eyebrow" style={{ color: "var(--accent)" }}>
              Recruitment intelligence
            </p>
            <h3>Cycle-dated, moderated</h3>
            <p>
              Stage, format, themes and reflections — no confidential material. Discussion is
              supporting context.
            </p>
            <Link
              className="button-link button-secondary compact-button"
              href="/member/learn/intelligence"
            >
              Explore reports
            </Link>
          </article>
        </div>
        <div className="direct-tool-grid" style={{ marginTop: "var(--space-3)" }}>
          <article className="card compact-card direct-tool-card">
            <h3>Questions</h3>
            <p>Browse curated questions by family and stage.</p>
            <Link
              className="button-link button-secondary compact-button"
              href="/member/learn/answer-bank/questions"
            >
              Browse questions
            </Link>
          </article>
          <article className="card compact-card direct-tool-card">
            <h3>Resources</h3>
            <p>Guides, checklists and exercises.</p>
            <Link
              className="button-link button-secondary compact-button"
              href="/member/learn/resources"
            >
              Browse resources
            </Link>
          </article>
          <article className="card compact-card direct-tool-card">
            <h3>Preparation Plans</h3>
            <p>Optional, stage-specific — not mandatory.</p>
            <Link
              className="button-link button-secondary compact-button"
              href="/member/learn/paths"
            >
              View plans
            </Link>
          </article>
          <article className="card compact-card direct-tool-card">
            <h3>Practice</h3>
            <p>Group Mock and bounded feedback pilots.</p>
            <Link
              className="button-link button-secondary compact-button"
              href="/member/learn/practice"
            >
              View pilots
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
