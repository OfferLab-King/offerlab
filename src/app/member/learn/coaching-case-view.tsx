"use client";

import { useMemo, useState } from "react";
import type { CoachingCaseDetail } from "../../../modules/preparation-resources/domain/coaching-case";
import { coachingCaseTone } from "../../components/coaching-case-tone";

type Piece = {
  change?: CoachingCaseDetail["changes"][number];
  kind: "same" | "delete" | "insert";
  text: string;
};

function pieces(detail: CoachingCaseDetail, comparison: boolean): Piece[] {
  const output: Piece[] = [];
  let cursor = 0;
  for (const change of [...detail.changes].sort((a, b) => a.start - b.start)) {
    if (cursor < change.start)
      output.push({ kind: "same", text: detail.originalAnswer.slice(cursor, change.start) });
    output.push({
      change,
      kind: "delete",
      text: detail.originalAnswer.slice(change.start, change.end),
    });
    if (comparison && change.replacement)
      output.push({ change, kind: "insert", text: change.replacement });
    cursor = change.end;
  }
  if (cursor < detail.originalAnswer.length)
    output.push({ kind: "same", text: detail.originalAnswer.slice(cursor) });
  return output;
}

export function CoachingCaseView({ detail }: { detail: CoachingCaseDetail }) {
  const [selected, setSelected] = useState(detail.changes[0]?.id ?? null);
  const [comparison, setComparison] = useState(true);
  const rendered = useMemo(() => pieces(detail, comparison), [comparison, detail]);
  function jump(id: string) {
    setSelected(id);
    document
      .querySelector<HTMLElement>(`[data-case-change="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return (
    <section aria-labelledby="case-review-title" className="coaching-case-review">
      <header className="case-review-toolbar">
        <div>
          <p className="eyebrow">Annotated coaching case</p>
          <h2 id="case-review-title">See the edit and the reasoning</h2>
        </div>
        <div className="case-view-toggle" role="group" aria-label="Answer view">
          <button
            aria-pressed={comparison}
            className={comparison ? "is-active" : ""}
            onClick={() => setComparison(true)}
            type="button"
          >
            Show changes
          </button>
          <button
            aria-pressed={!comparison}
            className={!comparison ? "is-active" : ""}
            onClick={() => setComparison(false)}
            type="button"
          >
            Original only
          </button>
        </div>
      </header>
      <div className="case-question">
        <span>Question</span>
        <p>{detail.question}</p>
      </div>
      <div className="case-review-workspace">
        <article
          aria-label={comparison ? "Answer with tracked changes" : "Original answer"}
          className={`case-document${comparison ? " is-comparison" : " is-original"}`}
        >
          <p className="case-document-label">
            {comparison ? "Tracked changes" : "Original answer"}
          </p>
          <p className="case-answer-copy">
            {rendered.map((piece, index) => {
              if (!piece.change) return <span key={index}>{piece.text}</span>;
              const active = selected === piece.change.id;
              const commentIndex = detail.changes.findIndex(
                (change) => change.id === piece.change?.id,
              );
              return piece.kind === "delete" ? (
                <del
                  className={`case-change case-change-${piece.change.category.toLowerCase()}${active ? " is-selected" : ""}`}
                  data-case-change={piece.change.id}
                  key={`d-${piece.change.id}`}
                  onClick={() => setSelected(piece.change!.id)}
                  style={coachingCaseTone(commentIndex)}
                >
                  {piece.text}
                </del>
              ) : (
                <ins
                  className={`case-insertion${active ? " is-selected" : ""}`}
                  key={`i-${piece.change.id}`}
                  onClick={() => setSelected(piece.change!.id)}
                  style={coachingCaseTone(commentIndex)}
                >
                  {piece.text}
                </ins>
              );
            })}
          </p>
        </article>
        <aside aria-label="Coach comments" className="case-comments">
          <h3>Coach comments</h3>
          {detail.changes.map((change, index) => (
            <article
              className={`case-comment${selected === change.id ? " is-selected" : ""}`}
              data-case-comment={change.id}
              key={change.id}
              style={coachingCaseTone(index)}
            >
              <div>
                <span className="case-comment-number">{index + 1}</span>
                <span className={`coach-category coach-category-${change.category.toLowerCase()}`}>
                  {change.category}
                </span>
              </div>
              <h4>{change.heading}</h4>
              <p>{change.explanation}</p>
              <button className="button-quiet" onClick={() => jump(change.id)} type="button">
                Jump to change
              </button>
            </article>
          ))}
        </aside>
      </div>
      <div className="case-learning-grid">
        <section>
          <h3>Common mistakes shown here</h3>
          <ul>
            {detail.keyWeaknesses.map((weakness) => (
              <li key={weakness}>{weakness}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Why the revised answer is stronger</h3>
          <p>{detail.whyStronger}</p>
        </section>
      </div>
      <section className="case-practice-prompt">
        <p className="eyebrow">Try it yourself</p>
        <h3>Practice prompt</h3>
        <p>{detail.practicePrompt}</p>
      </section>
    </section>
  );
}
