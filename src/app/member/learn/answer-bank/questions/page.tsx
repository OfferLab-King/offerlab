import Link from "next/link";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readQuestions } from "../../../../../modules/answer-bank/application/answer-bank";
import { questionFamilies } from "../../../../../modules/answer-bank/domain/answer-bank";
import { AnswerBankShell } from "../shell";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ family?: string; status?: string }>;
}) {
  const { userId } = await requireMember(),
    q = await readQuestions(userId),
    f = await searchParams;
  const shown = q.filter(
    (x) => (!f.family || x.family === f.family) && (!f.status || x.status === f.status),
  );
  return (
    <AnswerBankShell active="questions">
      <header className="applications-heading">
        <p className="eyebrow">Interview Questions</p>
        <h1>Core Interview Questions</h1>
        <p className="intro">
          Prioritise prompts relevant to your applications; you do not need to complete every
          question.
        </p>
        <strong>
          {q.filter((x) => x.status === "Ready").length} of {q.length} answers ready
        </strong>
      </header>
      <form className="filter-bar">
        <label htmlFor="family">Family</label>
        <select id="family" name="family" defaultValue={f.family ?? ""}>
          <option value="">All families</option>
          {Object.entries(questionFamilies).map(([k, l]) => (
            <option value={k} key={k}>
              {l}
            </option>
          ))}
        </select>
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={f.status ?? ""}>
          <option value="">All statuses</option>
          <option>Not started</option>
          <option>Draft</option>
          <option>Ready</option>
        </select>
        <button type="submit">Filter</button>
      </form>
      <section className="item-list">
        {shown.map((x) => (
          <article className="card compact-card" key={x.id}>
            <span className="status-badge">{x.status}</span>
            <h2>{x.prompt}</h2>
            <p>{questionFamilies[x.family]}</p>
            {x.stages.length > 0 && <p>Relevant stages: {x.stages.join(", ")}</p>}
            <Link href={`/member/learn/answer-bank/answers/new?question=${x.id}`}>
              {x.status === "Not started"
                ? "Draft answer"
                : x.status === "Draft"
                  ? "Continue"
                  : "Review"}
            </Link>
          </article>
        ))}
      </section>
    </AnswerBankShell>
  );
}
