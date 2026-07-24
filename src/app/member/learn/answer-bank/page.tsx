import Link from "next/link";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import {
  readAnswerBankSummary,
  readAnswers,
  readStories,
} from "../../../../modules/answer-bank/application/answer-bank";
import { competencies, questionFamilies } from "../../../../modules/answer-bank/domain/answer-bank";
import { AnswerBankShell } from "./shell";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { userId } = await requireMember();
  const [s, stories, answers] = await Promise.all([
    readAnswerBankSummary(userId),
    readStories(userId),
    readAnswers(userId),
  ]);
  return (
    <AnswerBankShell active="overview">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">My Answer &amp; Story Bank</p>
          <h1>Your preparation</h1>
          <p className="intro">Build reusable answers and evidence stories for interviews.</p>
        </div>
      </header>
      <section className="metric-grid" aria-label="Preparation totals">
        <article className="card">
          <strong>{s.stories}</strong>
          <span>Stories</span>
          <small>{s.readyStories} Ready</small>
        </article>
        <article className="card">
          <strong>{s.answers}</strong>
          <span>Answers</span>
          <small>{s.readyAnswers} Ready</small>
        </article>
      </section>
      <section className="learn-section">
        <h2>Next recommended action</h2>
        <div className="card">
          <p>{s.nextAction}</p>
          <div className="form-actions">
            <Link
              className="button-link"
              href={
                s.readyStories
                  ? "/member/learn/answer-bank/questions"
                  : "/member/learn/answer-bank/stories/new"
              }
            >
              Continue preparation
            </Link>
          </div>
        </div>
      </section>
      <section className="learn-section">
        <h2>Question coverage</h2>
        <div className="coverage-grid">
          {Object.entries(questionFamilies).map(([key, label]) => {
            const xs = answers.filter((a) => a.questionFamily === key);
            return (
              <article className="card compact-card" key={key}>
                <h3>{label}</h3>
                <p>
                  {xs.filter((a) => a.ready).length} Ready · {xs.filter((a) => !a.ready).length}{" "}
                  Draft
                </p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="learn-section">
        <h2>Competency coverage</h2>
        <div className="coverage-grid">
          {Object.entries(competencies).map(([key, label]) => {
            const count = stories.filter(
              (x) => x.ready && x.competencies.includes(key as keyof typeof competencies),
            ).length;
            return (
              <article className="card compact-card" key={key}>
                <h3>{label}</h3>
                <p>
                  {count > 0
                    ? "Covered"
                    : stories.some((x) => x.competencies.includes(key as keyof typeof competencies))
                      ? "Needs another example"
                      : "Not yet covered"}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </AnswerBankShell>
  );
}
