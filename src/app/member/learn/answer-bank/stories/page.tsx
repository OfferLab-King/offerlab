import Link from "next/link";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readStories } from "../../../../../modules/answer-bank/application/answer-bank";
import {
  competencies,
  experienceTypes,
} from "../../../../../modules/answer-bank/domain/answer-bank";
import { AnswerBankShell } from "../shell";
export default async function Page() {
  const { userId } = await requireMember();
  const stories = await readStories(userId);
  return (
    <AnswerBankShell active="stories">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Story Bank</p>
          <h1>Evidence stories</h1>
          <p className="intro">Build reusable examples using STAR plus reasoning and reflection.</p>
        </div>
        <Link className="button-link" href="/member/learn/answer-bank/stories/new">
          Add a story
        </Link>
      </header>
      {!stories.length ? (
        <section className="card empty-state">
          <h2>Build your first evidence story</h2>
          <p>
            Start with a strong example from education, employment, volunteering, an internship or a
            personal project.
          </p>
          <Link className="button-link" href="/member/learn/answer-bank/stories/new">
            Add a story
          </Link>
        </section>
      ) : (
        <section className="item-list">
          {stories.map((s) => (
            <article className="card compact-card" key={s.id}>
              <span className="status-badge">{s.ready ? "Ready" : "Draft"}</span>
              <h2>{s.title}</h2>
              <p>{experienceTypes[s.experienceType]}</p>
              <p>
                {s.competencies.map((k) => competencies[k]).join(", ") || "No competencies mapped"}
              </p>
              <p>
                {s.answerCount} {s.answerCount === 1 ? "answer uses" : "answers use"} this story
              </p>
              <Link href={`/member/learn/answer-bank/stories/${s.id}`}>
                {s.ready ? "Review" : "Edit"}
              </Link>
            </article>
          ))}
        </section>
      )}
    </AnswerBankShell>
  );
}
