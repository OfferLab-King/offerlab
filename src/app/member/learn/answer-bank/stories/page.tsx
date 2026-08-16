import Link from "next/link";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readStories } from "../../../../../modules/answer-bank/application/answer-bank";
import {
  competencies,
  experienceTypes,
} from "../../../../../modules/answer-bank/domain/answer-bank";
import { AnswerBankShell } from "../shell";
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { userId } = await requireMember();
  const archived = (await searchParams).view === "archived";
  const stories = await readStories(userId, archived);
  return (
    <AnswerBankShell active="stories">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Story Bank</p>
          <h1>Evidence stories</h1>
          <p className="intro">Build reusable examples using STAR plus reasoning and reflection.</p>
        </div>
        <div className="heading-actions">
          <Link className="button-link" href="/member/learn/answer-bank/stories/new">
            Add a story
          </Link>
          <Link
            className="button-link button-secondary"
            href={
              archived
                ? "/member/learn/answer-bank/stories"
                : "/member/learn/answer-bank/stories?view=archived"
            }
          >
            {archived ? "View active stories" : "View archived stories"}
          </Link>
        </div>
      </header>
      {!stories.length ? (
        <section className="card empty-state">
          <h2>{archived ? "No archived stories" : "Build your first evidence story"}</h2>
          <p>
            {archived
              ? "Stories you archive will remain available here and can be restored at any time."
              : "Start with a strong example from education, employment, volunteering, an internship or a personal project."}
          </p>
          {!archived && (
            <Link className="button-link" href="/member/learn/answer-bank/stories/new">
              Add a story
            </Link>
          )}
        </section>
      ) : (
        <section className="item-list">
          {stories.map((s) => (
            <article className="card compact-card" key={s.id}>
              <span className="status-badge">
                {archived ? "Archived" : s.ready ? "Ready" : "Draft"}
              </span>
              <h2>{s.title}</h2>
              <p>{experienceTypes[s.experienceType]}</p>
              <p>
                {s.competencies.map((k) => competencies[k]).join(", ") || "No competencies mapped"}
              </p>
              <p>
                {s.answerCount} {s.answerCount === 1 ? "answer uses" : "answers use"} this story
              </p>
              <Link href={`/member/learn/answer-bank/stories/${s.id}`}>
                {archived ? "View and restore" : s.ready ? "Review" : "Edit"}
              </Link>
            </article>
          ))}
        </section>
      )}
    </AnswerBankShell>
  );
}
