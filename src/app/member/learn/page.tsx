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
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Prepare</p>
          <h1>Preparation Hub</h1>
          <p className="intro">
            Open the tool that helps today: build evidence, answer a question, follow a plan or find
            a focused resource.
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
          <p>Choose a Preparation Plan for the recruitment stage you are facing.</p>
          <Link className="button-link" href="/member/learn/paths">
            Choose a Preparation Plan
          </Link>
        </section>
      )}

      <section aria-labelledby="answer-story-bank" className="learn-section">
        <p className="eyebrow">My Answer &amp; Story Bank</p>
        <article className="card hub-panel">
          <div>
            <h2 id="answer-story-bank">Build reusable interview preparation</h2>
            <p>
              {bank.stories} evidence stories · {bank.readyAnswers} Ready answers
            </p>
            <p>{bank.competenciesCovered} of 10 core competencies covered</p>
            <p>
              <strong>Next:</strong> {bank.nextAction}
            </p>
          </div>
          <Link className="button-link" href="/member/learn/answer-bank">
            Open my Answer Bank
          </Link>
        </article>
      </section>

      <section aria-labelledby="structured-preparation" className="card hub-panel learn-section">
        <div>
          <h2 id="structured-preparation">Structured Preparation Plans</h2>
          <p>
            Follow complete preparation coverage for video interviews, online assessments,
            assessment centres and final interviews.
          </p>
        </div>
        <Link className="button-link" href="/member/learn/paths">
          View Preparation Plans
        </Link>
      </section>

      <section aria-labelledby="explore-directly" className="learn-section">
        <p className="eyebrow">Explore directly</p>
        <h2 id="explore-directly">Find the preparation you need</h2>
        <div className="direct-tool-grid">
          <article className="card compact-card direct-tool-card">
            <h3>Core Interview Questions</h3>
            <p>Browse curated questions by family, recruitment stage and preparation status.</p>
            <Link className="button-link" href="/member/learn/answer-bank/questions">
              Browse questions
            </Link>
          </article>
          <article className="card compact-card direct-tool-card">
            <h3>Resource Library</h3>
            <p>Find focused guides, exercises and checklists without following a plan.</p>
            <Link className="button-link" href="/member/learn/resources">
              Browse resources
            </Link>
          </article>
          <article className="card compact-card direct-tool-card">
            <h3>Annotated Coaching Cases</h3>
            <p>
              See how reasoning, trade-offs and coach annotations turn a scenario into useful
              practice.
            </p>
            <Link className="button-link" href="/member/learn/cases">
              Study a case
            </Link>
          </article>
          <article className="card compact-card direct-tool-card">
            <h3>Practice &amp; Feedback</h3>
            <p>Register interest in a Group Mock, answer review or focused mock-interview pilot.</p>
            <Link className="button-link" href="/member/learn/practice">
              View pilots
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="distinctive-tools" className="learn-section upcoming-experiences">
        <p className="eyebrow">OfferLab tools</p>
        <h2 id="distinctive-tools">Go beyond generic preparation</h2>
        <div className="upcoming-grid">
          <article>
            <span className="availability-label">Local prototype</span>
            <h3>Answer Coach</h3>
            <p>
              Open an answer for an evidence-grounded rubric review. No AI provider receives your
              content.
            </p>
            <Link href="/member/learn/answer-bank/answers">Review an answer</Link>
          </article>
          <article>
            <span className="availability-label">Register interest</span>
            <h3>Group Mock</h3>
            <p>Structured group-exercise practice with peer or facilitator feedback.</p>
            <Link href="/member/learn/practice">View the pilot</Link>
          </article>
          <article>
            <span className="availability-label">Human moderated</span>
            <h3>Recruitment intelligence</h3>
            <p>Moderated, cycle-dated candidate reports by stage, format and assessed skill.</p>
            <Link href="/member/learn/intelligence">Explore reports</Link>
          </article>
        </div>
      </section>
    </main>
  );
}
