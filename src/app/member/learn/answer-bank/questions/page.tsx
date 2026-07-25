import Link from "next/link";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readQuestions } from "../../../../../modules/answer-bank/application/answer-bank";
import {
  questionFamilies,
  questionMatchesFilters,
} from "../../../../../modules/answer-bank/domain/answer-bank";
import { recruitmentStages } from "../../../../../modules/applications/domain/application";
import { AnswerBankShell } from "../shell";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ family?: string; stage?: string; status?: string }>;
}) {
  const { userId } = await requireMember(),
    q = await readQuestions(userId),
    f = await searchParams;
  const shown = q.filter((question) => questionMatchesFilters(question, f));
  return (
    <AnswerBankShell active="questions">
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Interview Questions</p>
          <h1>Core Interview Questions</h1>
          <p className="intro">
            Prioritise prompts relevant to your applications; you do not need to complete every
            question.
          </p>
        </div>
        {q.length > 0 && (
          <strong className="application-count">
            {q.filter((x) => x.status === "Ready").length} of {q.length} answers ready
          </strong>
        )}
      </header>
      {!f.family && !f.stage && !f.status && q.length > 0 && (
        <section aria-labelledby="top-questions" className="card top-question-collection">
          <p className="eyebrow">Curated starting point</p>
          <h2 id="top-questions">Top 10 interview questions</h2>
          <p>
            Start with the canonical questions that cover introductions, motivation, evidence and
            reflection. The order is editorially controlled and stable.
          </p>
          <ol>
            {q.slice(0, 10).map((question) => (
              <li key={question.id}>
                <Link href={`/member/learn/answer-bank/answers/new?question=${question.id}`}>
                  {question.prompt}
                </Link>
              </li>
            ))}
          </ol>
          <div className="form-actions">
            <Link href="?family=competency_and_behavioural">Competency collection</Link>
            <Link href="?family=motivation_and_fit">Motivation collection</Link>
            <Link href="?stage=assessment_centre">Assessment-centre collection</Link>
          </div>
        </section>
      )}
      <form className="filter-bar">
        <label htmlFor="family">
          Family
          <select id="family" name="family" defaultValue={f.family ?? ""}>
            <option value="">All families</option>
            {Object.entries(questionFamilies).map(([k, l]) => (
              <option value={k} key={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="status">
          Status
          <select id="status" name="status" defaultValue={f.status ?? ""}>
            <option value="">All statuses</option>
            <option>Not started</option>
            <option>Draft</option>
            <option>Ready</option>
          </select>
        </label>
        <label htmlFor="stage">
          Recruitment stage
          <select id="stage" name="stage" defaultValue={f.stage ?? ""}>
            <option value="">All stages</option>
            {Object.entries(recruitmentStages).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filter</button>
        {(f.family || f.status || f.stage) && (
          <Link href="/member/learn/answer-bank/questions">Clear filters</Link>
        )}
      </form>
      {f.stage && (
        <p className="hint">
          Includes questions for{" "}
          {recruitmentStages[f.stage as keyof typeof recruitmentStages] ?? "the selected stage"} and
          questions that apply generally.
        </p>
      )}
      <section className="item-list">
        {shown.map((x) => (
          <article className="card compact-card" key={x.id}>
            <span className="status-badge">{x.status}</span>
            <h2>{x.prompt}</h2>
            <p>{questionFamilies[x.family]}</p>
            <p>
              {x.stages.length > 0
                ? `Relevant stages: ${x.stages
                    .map((stage) => recruitmentStages[stage as keyof typeof recruitmentStages])
                    .filter(Boolean)
                    .join(", ")}`
                : "Generally applicable"}
            </p>
            <Link href={`/member/learn/answer-bank/answers/new?question=${x.id}`}>
              {x.status === "Not started"
                ? "Draft answer"
                : x.status === "Draft"
                  ? "Continue"
                  : "Review"}
            </Link>
          </article>
        ))}
        {!shown.length && (
          <article className="card empty-state">
            <h2>No questions match these filters</h2>
            <p>Clear the filters or choose another stage, family or status.</p>
            <Link href="/member/learn/answer-bank/questions">Clear filters</Link>
          </article>
        )}
      </section>
    </AnswerBankShell>
  );
}
