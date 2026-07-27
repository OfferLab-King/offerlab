"use client";
import { useMemo, useRef, useState } from "react";
import type { StoredReview } from "../../../../../../modules/answer-coach/infrastructure/review-repository";

function HighlightedAnswer({
  review,
  selected,
  onSelect,
}: {
  review: StoredReview;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const parts = useMemo(() => {
    const comments = review.comments
      .filter((item) => item.state !== "dismissed")
      .sort((a, b) => a.anchor.start - b.anchor.start);
    const output: { comment?: (typeof comments)[number]; text: string }[] = [];
    let cursor = 0;
    for (const comment of comments) {
      if (comment.anchor.start < cursor) continue;
      if (cursor < comment.anchor.start)
        output.push({ text: review.answerSnapshot.slice(cursor, comment.anchor.start) });
      output.push({ comment, text: comment.anchor.quote });
      cursor = comment.anchor.end;
    }
    if (cursor < review.answerSnapshot.length)
      output.push({ text: review.answerSnapshot.slice(cursor) });
    return output;
  }, [review]);
  return (
    <p className="coach-answer-text">
      {parts.map((part, index) =>
        part.comment ? (
          <mark
            className={`coach-highlight coach-highlight-${part.comment.category.toLowerCase()}${selected === part.comment.id ? " is-selected" : ""}`}
            data-comment-id={part.comment.id}
            key={part.comment.id}
            onClick={() => onSelect(part.comment!.id)}
            tabIndex={0}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function AnswerCoachPanel({
  answerId,
  initialReviews,
}: {
  answerId: string;
  initialReviews: StoredReview[];
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [reviews, setReviews] = useState(initialReviews);
  const [reviewIndex, setReviewIndex] = useState(0),
    [selected, setSelected] = useState<string | null>(initialReviews[0]?.comments[0]?.id ?? null),
    [mobileOpen, setMobileOpen] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null),
    review = reviews[reviewIndex] ?? null;
  async function runReview() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/member/answer-bank/answers/${answerId}/coach`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "We could not review this answer. Please try again.");
      setReviews((current) => [result.review, ...current]);
      setReviewIndex(0);
      setSelected(result.review.comments[0]?.id ?? null);
      setMobileOpen(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not review this answer. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  async function changeState(commentId: string, state: "addressed" | "dismissed") {
    const response = await fetch(`/api/member/answer-bank/answers/${answerId}/coach`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commentId, state }),
    });
    if (!response.ok) {
      setError("We could not update that comment.");
      return;
    }
    setReviews((current) =>
      current.map((item, index) =>
        index === reviewIndex
          ? {
              ...item,
              comments: item.comments.map((comment) =>
                comment.id === commentId ? { ...comment, state } : comment,
              ),
            }
          : item,
      ),
    );
  }
  function jump(commentId: string) {
    setSelected(commentId);
    setMobileOpen(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }
  const comments = review?.comments ?? [];
  return (
    <section aria-labelledby="answer-coach-title" className="answer-coach-review-mode">
      <header className="coach-toolbar">
        <div>
          <p className="eyebrow">Answer Coach · local rubric pilot</p>
          <h2 id="answer-coach-title">Review mode</h2>
        </div>
        <div className="coach-toolbar-actions">
          {reviews.length > 1 && (
            <label>
              Review{" "}
              <select
                aria-label="Previous review"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setReviewIndex(next);
                  setSelected(reviews[next]?.comments[0]?.id ?? null);
                }}
                value={reviewIndex}
              >
                {reviews.map((item, index) => (
                  <option key={item.id} value={index}>
                    {index === 0 ? "Latest" : new Date(item.createdAt).toLocaleString("en-GB")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button disabled={pending} onClick={() => void runReview()} type="button">
            {pending ? "Reviewing…" : review ? "Review again" : "Review this answer"}
          </button>
          {review && (
            <button
              className="button-secondary coach-mobile-comments"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              Comments ({comments.filter((item) => item.state === "open").length})
            </button>
          )}
        </div>
      </header>
      <p className="coach-privacy-note">
        Uses only this answer and up to three linked stories. The local fallback sends nothing to an
        AI provider. Reviews are saved; your answer is never edited automatically.
      </p>
      {error && <p role="alert">{error}</p>}
      {!review ? (
        <div className="coach-empty">
          <h3>Focused comments, anchored to your draft</h3>
          <p>
            Review for evidence, reasoning, relevance, structure and reflection. You decide every
            edit.
          </p>
        </div>
      ) : (
        <div className="coach-workspace">
          <article aria-label="Answer canvas" className="coach-answer-canvas">
            <div className="coach-page">
              <p className="coach-review-summary">{review.summary}</p>
              <HighlightedAnswer
                onSelect={(id) => {
                  setSelected(id);
                  commentsRef.current
                    ?.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
                    ?.focus();
                }}
                review={review}
                selected={selected}
              />
              <footer>
                Answer version {review.answerVersion} · reviewed{" "}
                {new Date(review.createdAt).toLocaleString("en-GB")}
              </footer>
            </div>
          </article>
          <div
            aria-label="Coaching comments"
            className={`coach-comments-panel${mobileOpen ? " is-open" : ""}`}
            ref={commentsRef}
            role={mobileOpen ? "dialog" : undefined}
          >
            <div className="coach-comments-heading">
              <div>
                <p className="eyebrow">Comments</p>
                <h3>{comments.filter((item) => item.state === "open").length} open</h3>
              </div>
              <button
                aria-label="Close comments"
                className="coach-comments-close"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="coach-comment-list">
              {comments.map((comment) => (
                <article
                  className={`coach-comment-card is-${comment.state}${selected === comment.id ? " is-selected" : ""}`}
                  data-card-id={comment.id}
                  key={comment.id}
                  tabIndex={-1}
                >
                  <span
                    className={`coach-category coach-category-${comment.category.toLowerCase()}`}
                  >
                    {comment.category}
                  </span>
                  <p>{comment.observation}</p>
                  <p className="coach-question">{comment.coachingQuestion}</p>
                  <div className="coach-comment-actions">
                    <button className="button-quiet" onClick={() => jump(comment.id)} type="button">
                      Jump to highlight
                    </button>
                    {comment.state === "open" && (
                      <>
                        <button
                          className="button-quiet"
                          onClick={() => void changeState(comment.id, "addressed")}
                          type="button"
                        >
                          Mark addressed
                        </button>
                        <button
                          className="button-quiet"
                          onClick={() => void changeState(comment.id, "dismissed")}
                          type="button"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
          {mobileOpen && (
            <button
              aria-label="Close comments"
              className="coach-sheet-backdrop"
              onClick={() => setMobileOpen(false)}
              type="button"
            />
          )}
        </div>
      )}
    </section>
  );
}
