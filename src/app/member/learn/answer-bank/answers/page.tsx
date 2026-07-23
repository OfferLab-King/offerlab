import Link from "next/link";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import {
  readAnswers,
  readStories,
} from "../../../../../modules/answer-bank/application/answer-bank";
import { questionFamilies } from "../../../../../modules/answer-bank/domain/answer-bank";
import { AnswerBankShell } from "../shell";
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { userId } = await requireMember();
  const archived = (await searchParams).view === "archived";
  const [answers, stories] = await Promise.all([
    readAnswers(userId, archived),
    readStories(userId),
  ]);
  return (
    <AnswerBankShell active="answers">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Answer Bank</p>
          <h1>Interview answers</h1>
        </div>
        <Link className="button-link" href="/member/learn/answer-bank/answers/new">
          Draft an answer
        </Link>
        <Link
          href={
            archived
              ? "/member/learn/answer-bank/answers"
              : "/member/learn/answer-bank/answers?view=archived"
          }
        >
          {archived ? "View active answers" : "View archived answers"}
        </Link>
      </header>
      {!answers.length ? (
        <section className="card empty-state">
          <h2>Draft your first interview answer</h2>
          <p>Start from a Core Interview Question or add a custom question.</p>
          <Link className="button-link" href="/member/learn/answer-bank/questions">
            Browse questions
          </Link>
        </section>
      ) : (
        <section className="item-list">
          {answers.map((a) => (
            <article className="card compact-card" key={a.id}>
              <span className="status-badge">
                {archived ? "Archived" : a.ready ? "Ready" : "Draft"}
              </span>
              <h2>{a.question}</h2>
              <p>{questionFamilies[a.questionFamily]}</p>
              {a.applicationLabel && <p>{a.applicationLabel}</p>}
              <p>
                {a.storyIds
                  .map((id) => stories.find((s) => s.id === id)?.title ?? "Archived story")
                  .join(", ") || "No linked stories"}
              </p>
              <Link href={`/member/learn/answer-bank/answers/${a.id}`}>
                {archived ? "View and restore" : a.ready ? "Review" : "Continue"}
              </Link>
            </article>
          ))}
        </section>
      )}
    </AnswerBankShell>
  );
}
