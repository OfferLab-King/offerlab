import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownContent } from "../../../../../components/resource-content";
import { requireMember } from "../../../../../../modules/identity-access/application/authorization";
import { readGroupMockCase } from "../../../../../../modules/practice-services/application/group-mock";
import {
  groupMockDifficulties,
  groupMockExerciseTypes,
  groupMockProblemTypes,
  groupMockSectors,
} from "../../../../../../modules/practice-services/domain/group-mock";
import { LearnNavigation } from "../../../learn-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function GroupMockCasePage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { userId } = await requireMember();
  const material = await readGroupMockCase(userId, (await params).materialId);
  if (!material) notFound();
  return (
    <main className="applications-shell">
      <LearnNavigation active="practice" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">
            {groupMockSectors[material.sector]} · {groupMockProblemTypes[material.problem_type]}
          </p>
          <h1>{material.title}</h1>
          <p className="intro">{material.summary}</p>
        </div>
        <Link className="button-secondary button-link" href="/member/learn/practice/cases">
          Back to case library
        </Link>
      </section>
      <div className="group-mock-case-meta">
        <span>{groupMockExerciseTypes[material.exercise_type]}</span>
        <span>{groupMockDifficulties[material.difficulty]}</span>
        <span>Group of {material.recommended_group_size}</span>
        <span>
          {material.preparation_minutes} min prepare · {material.discussion_minutes} min discuss ·{" "}
          {material.follow_up_minutes} min follow-up
        </span>
      </div>
      <div className="group-mock-material-layout">
        <article className="group-mock-material-sheet">
          <section>
            <p className="eyebrow">Candidate brief</p>
            <MarkdownContent markdown={material.scenario} />
          </section>
          <section>
            <h2>Working instructions</h2>
            <MarkdownContent markdown={material.participant_instructions} />
          </section>
          <section>
            <h2>Case pack</h2>
            <MarkdownContent markdown={material.information_pack} />
          </section>
          <section>
            <h2>Required output</h2>
            <MarkdownContent markdown={material.deliverable} />
          </section>
        </article>
        <aside className="group-mock-facilitator-panel">
          <p className="eyebrow">Facilitator guide</p>
          <MarkdownContent markdown={material.observer_rubric} />
          <h2>Debrief questions</h2>
          <ol>
            {material.debrief_questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
