"use client";
import { useState } from "react";
import type { AnswerCoachReview } from "../../../../../../modules/answer-coach/domain/review";

export function AnswerCoachPanel({ answerId }: { answerId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<AnswerCoachReview | null>(null);
  async function runReview() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/member/answer-bank/answers/${answerId}/coach`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("review_failed");
      const result = await response.json();
      setReview(result.review);
    } catch {
      setError("We could not review this answer. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-labelledby="answer-coach-title" className="card answer-coach-panel">
      <p className="eyebrow">Answer Coach prototype</p>
      <h2 id="answer-coach-title">Get a focused rubric review</h2>
      <p>
        This local prototype reads this answer and its linked stories. No AI provider receives your
        content, nothing is saved and the review never changes your draft.
      </p>
      <button disabled={pending} onClick={() => void runReview()} type="button">
        {pending ? "Reviewing…" : "Review this answer"}
      </button>
      {error && <p role="alert">{error}</p>}
      {review && (
        <div aria-live="polite" className="coach-review">
          <p>{review.summary}</p>
          <div className="direct-tool-grid">
            <section>
              <h3>What is working</h3>
              {review.strengths.length ? (
                <ul>
                  {review.strengths.map((item) => (
                    <li key={item.heading}>
                      <strong>{item.heading}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Add more evidence to unlock specific strengths.</p>
              )}
            </section>
            <section>
              <h3>Next edit</h3>
              <ul>
                {review.priorities.map((item) => (
                  <li key={item.heading}>
                    <strong>{item.heading}:</strong> {item.detail}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <h3>Questions to sharpen the answer</h3>
          <ul>
            {review.coachingQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
