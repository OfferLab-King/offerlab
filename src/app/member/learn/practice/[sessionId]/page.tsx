import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownContent } from "../../../../components/resource-content";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readGroupMockSession } from "../../../../../modules/practice-services/application/group-mock";
import { MemberApplicationsHeader } from "../../../applications/member-applications-header";
import { LearnNavigation } from "../../learn-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function GroupMockSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { userId } = await requireMember();
  const { sessionId } = await params;
  const result = await readGroupMockSession(userId, sessionId);
  if (!result) notFound();
  const { material, session } = result;
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="practice" />
      <section className="applications-heading group-mock-detail-heading">
        <div>
          <p className="eyebrow">Group Mock session</p>
          <h1>{session.title}</h1>
          <p className="intro">
            {new Date(session.startsAt).toLocaleString("en-GB", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Europe/London",
            })}{" "}
            · {session.confirmedCount} confirmed
          </p>
        </div>
        <Link className="button-secondary button-link" href="/member/learn/practice">
          Back to rooms
        </Link>
      </section>
      {session.joinUrl ? (
        <section className="success-summary group-mock-join" aria-label="Meeting access">
          <div>
            <strong>The meeting room is open</strong>
            <p>Use your own name. Do not share the link or record the session.</p>
          </div>
          <a
            className="button-link"
            href={session.joinUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Enter meeting
          </a>
        </section>
      ) : (
        <p className="notice-summary">
          The private meeting link appears here 15 minutes before the start time for confirmed
          participants.
        </p>
      )}
      {!material ? (
        <section className="card empty-state">
          <h2>Material not available yet</h2>
          <p>Your booking must be confirmed before the full exercise pack is available.</p>
        </section>
      ) : (
        <div className="group-mock-material-layout">
          <article className="group-mock-material" aria-labelledby="exercise-material-heading">
            <header>
              <p className="eyebrow">Exercise material</p>
              <h2 id="exercise-material-heading">{material.title}</h2>
              <p>{material.summary}</p>
            </header>
            <section>
              <p className="eyebrow">Exercise brief</p>
              <h2>Scenario</h2>
              <MarkdownContent markdown={material.scenario} />
            </section>
            <section>
              <h2>Instructions</h2>
              <MarkdownContent markdown={material.participant_instructions} />
            </section>
            <section>
              <h2>Information pack</h2>
              <MarkdownContent markdown={material.information_pack} />
            </section>
            <section>
              <h2>Group deliverable</h2>
              <MarkdownContent markdown={material.deliverable} />
            </section>
          </article>
          <aside className="group-mock-observer-guide">
            <p className="eyebrow">Use after the exercise</p>
            <h2>Reflection guide</h2>
            <MarkdownContent markdown={material.observer_rubric} />
            <h3>Debrief questions</h3>
            <ol>
              {material.debrief_questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </main>
  );
}
