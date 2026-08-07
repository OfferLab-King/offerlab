"use client";

import { useMemo, useState } from "react";
import type {
  Answer,
  Question,
} from "../../../../modules/answer-bank/infrastructure/answer-bank-repository";
import type {
  AnswerCoachUsage,
  StoredReview,
} from "../../../../modules/answer-coach/infrastructure/review-repository";

type Configuration = Readonly<{ modelAvailable: boolean }>;

function HighlightedDraft({
  review,
  selectedId,
}: {
  review: StoredReview;
  selectedId: string | undefined;
}) {
  const parts = useMemo(() => {
    const comments = [...review.comments].sort((a, b) => a.anchor.start - b.anchor.start);
    const result: { category?: string; color?: number; id?: string; text: string }[] = [];
    let cursor = 0;
    for (const comment of comments) {
      if (comment.anchor.start < cursor) continue;
      if (cursor < comment.anchor.start)
        result.push({ text: review.answerSnapshot.slice(cursor, comment.anchor.start) });
      result.push({
        category: comment.category.toLowerCase(),
        color: review.comments.findIndex((candidate) => candidate.id === comment.id) % 5,
        id: comment.id,
        text: comment.anchor.quote,
      });
      cursor = comment.anchor.end;
    }
    if (cursor < review.answerSnapshot.length)
      result.push({ text: review.answerSnapshot.slice(cursor) });
    return result;
  }, [review]);
  return (
    <p className="simple-coach-draft">
      {parts.map((part, index) =>
        part.id ? (
          <mark
            className={selectedId === part.id ? "is-selected" : undefined}
            data-category={part.category}
            data-comment-color={part.color}
            data-simple-comment={part.id}
            key={part.id}
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

function statusFor(answer: Answer | undefined, draft: string) {
  if (answer?.ready) return "Prepared";
  if (answer || draft.trim()) return "Draft";
  return "Not started";
}

export function QuestionAnswerWorkspace({
  answers,
  configuration,
  initialUsage,
  questions,
}: {
  answers: Answer[];
  configuration: Configuration;
  initialUsage: AnswerCoachUsage;
  questions: Question[];
}) {
  const initialRecords: Record<string, Answer> = {};
  for (const answer of answers)
    if (answer.questionId && !initialRecords[answer.questionId])
      initialRecords[answer.questionId] = answer;
  const [records, setRecords] = useState<Record<string, Answer>>(initialRecords);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initialRecords).map(([questionId, answer]) => [
        questionId,
        answer.draftAnswer,
      ]),
    ),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reviewHistories, setReviewHistories] = useState<Record<string, StoredReview[]>>({});
  const [reviewIndices, setReviewIndices] = useState<Record<string, number>>({});
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState<Record<string, boolean>>({});
  const [reviewHistoryLoaded, setReviewHistoryLoaded] = useState<Record<string, boolean>>({});
  const [selectedComments, setSelectedComments] = useState<Record<string, string>>({});
  const [suggestedDrafts, setSuggestedDrafts] = useState<Record<string, string>>({});
  const [appliedCommentRevisions, setAppliedCommentRevisions] = useState<Record<string, boolean>>(
    {},
  );
  const [commentRevisionMessages, setCommentRevisionMessages] = useState<Record<string, string>>(
    {},
  );
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState(initialUsage);

  const prepared = Object.values(records).filter((answer) => answer.ready).length;
  const introduction = questions.filter(
    (question) =>
      question.family === "personal_introduction" || question.family === "motivation_and_fit",
  );
  const competency = questions.filter(
    (question) => question.family === "competency_and_behavioural",
  );

  async function loadReviewHistory(questionId: string, answerId: string) {
    if (reviewHistoryLoaded[questionId] || reviewHistoryLoading[questionId]) return;
    setReviewHistoryLoading((current) => ({ ...current, [questionId]: true }));
    try {
      const response = await fetch(`/api/member/answer-bank/answers/${answerId}/coach`);
      if (!response.ok) throw new Error("We could not load the saved reviews.");
      const result = (await response.json()) as { reviews: StoredReview[] };
      setReviewHistories((current) => {
        const existing = current[questionId] ?? [];
        const byId = new Map([...existing, ...result.reviews].map((review) => [review.id, review]));
        return {
          ...current,
          [questionId]: [...byId.values()].sort(
            (left, right) =>
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          ),
        };
      });
      setReviewHistoryLoaded((current) => ({ ...current, [questionId]: true }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [questionId]:
          error instanceof Error ? error.message : "We could not load the saved reviews.",
      }));
    } finally {
      setReviewHistoryLoading((current) => ({ ...current, [questionId]: false }));
    }
  }

  function toggleQuestion(question: Question) {
    const opening = activeId !== question.id;
    setActiveId(opening ? question.id : null);
    const answer = records[question.id];
    if (opening && answer) void loadReviewHistory(question.id, answer.id);
  }

  async function save(
    question: Question,
    ready: boolean,
    draftOverride?: string,
  ): Promise<Answer | null> {
    const existing = records[question.id];
    const draftAnswer = (draftOverride ?? drafts[question.id] ?? "").trim();
    if (!draftAnswer) {
      setMessages((current) => ({ ...current, [question.id]: "Write an answer first." }));
      return null;
    }
    setPending(question.id);
    setMessages((current) => ({ ...current, [question.id]: "" }));
    try {
      const response = await fetch(
        existing
          ? `/api/member/answer-bank/answers/${existing.id}`
          : "/api/member/answer-bank/answers",
        {
          body: JSON.stringify({
            applicationId: null,
            customQuestion: null,
            draftAnswer,
            keyPoints: "",
            questionFamily: question.family,
            questionId: question.id,
            ready,
            recruitmentStage: null,
            storyIds: [],
            title: question.prompt.slice(0, 160),
            ...(existing ? { version: existing.version } : {}),
          }),
          headers: { "content-type": "application/json" },
          method: existing ? "PUT" : "POST",
        },
      );
      const result = await response.json();
      if (!response.ok || !result.item)
        throw new Error(
          response.status === 409
            ? "This answer changed elsewhere. Reload and try again."
            : "We could not save this answer.",
        );
      const item = result.item as Answer;
      setRecords((current) => ({ ...current, [question.id]: item }));
      setDrafts((current) => ({ ...current, [question.id]: item.draftAnswer }));
      setMessages((current) => ({
        ...current,
        [question.id]: ready ? "Prepared answer saved." : "Draft saved.",
      }));
      return item;
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [question.id]: error instanceof Error ? error.message : "We could not save this answer.",
      }));
      return null;
    } finally {
      setPending(null);
    }
  }

  async function review(question: Question) {
    const saved = await save(question, false);
    if (!saved) return;
    setPending(question.id);
    try {
      const response = await fetch(`/api/member/answer-bank/answers/${saved.id}/coach`, {
        body: JSON.stringify({ modelConsent: consents[question.id] === true }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "We could not review this answer. Please try again.");
      const reviewResult = result.review as StoredReview;
      setReviewHistories((current) => ({
        ...current,
        [question.id]: [
          reviewResult,
          ...(current[question.id] ?? []).filter((item) => item.id !== reviewResult.id),
        ],
      }));
      setReviewIndices((current) => ({ ...current, [question.id]: 0 }));
      setReviewHistoryLoaded((current) => ({ ...current, [question.id]: true }));
      if (reviewResult.suggestedAnswer)
        setSuggestedDrafts((current) => ({
          ...current,
          [reviewResult.id]: reviewResult.suggestedAnswer!,
        }));
      setUsage(result.usage);
      setConsents((current) => ({ ...current, [question.id]: false }));
      setMessages((current) => ({
        ...current,
        [question.id]: result.fallbackUsed
          ? "AI review could not be completed, so this is a limited offline check. Try again for detailed highlights and a suggested answer."
          : "Review ready. Your answer has not been changed.",
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [question.id]: error instanceof Error ? error.message : "We could not review this answer.",
      }));
    } finally {
      setPending(null);
    }
  }

  function applySuggested(questionId: string, wording: string) {
    setDrafts((current) => ({ ...current, [questionId]: wording }));
    setRecords((current) => {
      const record = current[questionId];
      return record ? { ...current, [questionId]: { ...record, ready: false } } : current;
    });
    setMessages((current) => ({
      ...current,
      [questionId]: "Suggested wording copied into your draft. Check it, then save when ready.",
    }));
  }

  function applyCommentRevision(
    questionId: string,
    commentId: string,
    quote: string,
    wording: string,
  ) {
    const currentDraft = drafts[questionId] ?? "";
    const start = currentDraft.indexOf(quote);
    if (start < 0) {
      setCommentRevisionMessages((current) => ({
        ...current,
        [commentId]:
          "Your draft no longer contains the reviewed wording. Copy the suggestion manually if it is still useful.",
      }));
      return;
    }
    applySuggested(
      questionId,
      currentDraft.slice(0, start) + wording + currentDraft.slice(start + quote.length),
    );
    setAppliedCommentRevisions((current) => ({ ...current, [commentId]: true }));
    setCommentRevisionMessages((current) => ({
      ...current,
      [commentId]: "Replaced in your draft. Save the draft to keep this change.",
    }));
  }

  function jumpToComment(questionId: string, commentId: string) {
    setSelectedComments((current) => ({ ...current, [questionId]: commentId }));
    document.querySelector<HTMLElement>(`[data-simple-comment="${commentId}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  async function updateCommentState(
    question: Question,
    commentId: string,
    state: "addressed" | "dismissed",
  ) {
    const answer = records[question.id];
    if (!answer) return;
    setPending(question.id);
    try {
      const response = await fetch(`/api/member/answer-bank/answers/${answer.id}/coach`, {
        body: JSON.stringify({ commentId, state }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error("We could not update this comment.");
      setReviewHistories((current) => ({
        ...current,
        [question.id]: (current[question.id] ?? []).map((review) => ({
          ...review,
          comments: review.comments.map((comment) =>
            comment.id === commentId ? { ...comment, state } : comment,
          ),
        })),
      }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [question.id]: error instanceof Error ? error.message : "We could not update this comment.",
      }));
    } finally {
      setPending(null);
    }
  }

  function renderQuestion(question: Question, index: number) {
    const answer = records[question.id];
    const draft = drafts[question.id] ?? "";
    const history = reviewHistories[question.id] ?? [];
    const reviewIndex = Math.min(reviewIndices[question.id] ?? 0, Math.max(0, history.length - 1));
    const reviewResult = history[reviewIndex];
    const open = activeId === question.id;
    const status = statusFor(answer, draft);
    const wordCount = draft.trim() ? draft.trim().split(/\s+/u).length : 0;
    const busy = pending === question.id;
    return (
      <li
        className={`simple-question is-${status.toLowerCase().replace(" ", "-")}`}
        key={question.id}
      >
        <button
          aria-expanded={open}
          className="simple-question-heading"
          onClick={() => toggleQuestion(question)}
          type="button"
        >
          <span className="simple-question-number">{index}</span>
          <span>
            <strong>{question.prompt}</strong>
            <small>{status}</small>
          </span>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div className="simple-answer-editor">
            <p className="simple-question-guidance">{question.guidance}</p>
            <label htmlFor={`answer-${question.id}`}>Your answer</label>
            <textarea
              id={`answer-${question.id}`}
              onChange={(event) => {
                const value = event.target.value;
                setDrafts((current) => ({ ...current, [question.id]: value }));
                setAppliedCommentRevisions({});
                setCommentRevisionMessages({});
                if (records[question.id]?.ready)
                  setRecords((current) => ({
                    ...current,
                    [question.id]: { ...current[question.id]!, ready: false },
                  }));
              }}
              placeholder="Write your answer in your own words…"
              rows={9}
              value={draft}
            />
            <div className="simple-answer-meta">
              <span>{wordCount} words</span>
              <span>
                {question.family === "competency_and_behavioural"
                  ? "Use STAR, but keep the situation brief."
                  : "Aim for a focused answer you can say naturally."}
              </span>
            </div>
            {configuration.modelAvailable && (
              <label className="simple-ai-consent">
                <input
                  checked={consents[question.id] === true}
                  onChange={(event) =>
                    setConsents((current) => ({
                      ...current,
                      [question.id]: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  I agree to send this question, answer and any saved supporting evidence to
                  OfferLab’s AI provider for this review. I have removed confidential or identifying
                  information.
                  <small>Your answer is never changed automatically.</small>
                </span>
              </label>
            )}
            <div className="simple-answer-actions">
              <button
                className="button-secondary"
                disabled={busy}
                onClick={() => void save(question, false)}
                type="button"
              >
                Save draft
              </button>
              <button
                disabled={
                  busy || !draft.trim() || (configuration.modelAvailable && !consents[question.id])
                }
                onClick={() => void review(question)}
                type="button"
              >
                {busy ? "Working…" : reviewResult ? "Review again" : "Save & check with AI"}
              </button>
            </div>
            {messages[question.id] && (
              <p className="simple-answer-message" role="status">
                {messages[question.id]}
              </p>
            )}
            {reviewResult && (
              <section aria-label="AI answer review" className="simple-coach-result">
                <div className="simple-review-history-bar">
                  <div>
                    <strong>Saved review</strong>
                    <span>
                      Answer version {reviewResult.answerVersion} ·{" "}
                      {new Date(reviewResult.createdAt).toLocaleString("en-GB")}
                    </span>
                  </div>
                  {history.length > 1 ? (
                    <label>
                      Review history
                      <select
                        aria-label="Review history"
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          const nextReview = history[next];
                          setReviewIndices((current) => ({
                            ...current,
                            [question.id]: next,
                          }));
                          setSelectedComments((current) => ({
                            ...current,
                            [question.id]: nextReview?.comments[0]?.id ?? "",
                          }));
                        }}
                        value={reviewIndex}
                      >
                        {history.map((review, historyIndex) => (
                          <option key={review.id} value={historyIndex}>
                            {historyIndex === 0
                              ? "Latest review"
                              : new Date(review.createdAt).toLocaleString("en-GB")}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span>1 review saved</span>
                  )}
                </div>
                <header>
                  <div>
                    <p className="eyebrow">OfferLab review</p>
                    <h3>{reviewResult.summary}</h3>
                  </div>
                  <span>
                    {reviewResult.providerMode === "model" ? "AI review" : "Local review"}
                  </span>
                </header>
                <div className="simple-coach-layout">
                  <div>
                    <h4>Your answer with comments</h4>
                    <HighlightedDraft
                      review={reviewResult}
                      selectedId={selectedComments[question.id]}
                    />
                  </div>
                  <aside className="simple-comments-column">
                    <div className="simple-comments-heading">
                      <h4>Coach comments</h4>
                      <span>
                        {reviewResult.comments.filter((comment) => comment.state === "open").length}{" "}
                        open
                      </span>
                    </div>
                    <ol className="simple-coach-comments">
                      {reviewResult.comments.map((comment, commentIndex) => (
                        <li
                          className={`is-${comment.state}`}
                          data-category={comment.category.toLowerCase()}
                          data-comment-color={commentIndex % 5}
                          key={comment.id}
                        >
                          <span>{comment.category}</span>
                          <p>{comment.observation}</p>
                          <p className="coach-question">{comment.coachingQuestion}</p>
                          {comment.optionalRevision && (
                            <div className="simple-inline-revision">
                              <strong>Suggested replacement</strong>
                              <p>{comment.optionalRevision}</p>
                            </div>
                          )}
                          <div className="simple-comment-actions">
                            <button
                              className="button-quiet"
                              onClick={() => jumpToComment(question.id, comment.id)}
                              type="button"
                            >
                              Show in answer
                            </button>
                            {comment.optionalRevision && (
                              <button
                                className="button-quiet simple-apply-revision"
                                disabled={appliedCommentRevisions[comment.id] === true}
                                onClick={() =>
                                  applyCommentRevision(
                                    question.id,
                                    comment.id,
                                    comment.anchor.quote,
                                    comment.optionalRevision!,
                                  )
                                }
                                type="button"
                              >
                                {appliedCommentRevisions[comment.id]
                                  ? "Added to draft"
                                  : "Replace in draft"}
                              </button>
                            )}
                            <button
                              className="button-quiet"
                              disabled={busy || comment.state === "addressed"}
                              onClick={() =>
                                void updateCommentState(question, comment.id, "addressed")
                              }
                              type="button"
                            >
                              {comment.state === "addressed" ? "Addressed" : "Mark addressed"}
                            </button>
                            <button
                              className="button-quiet"
                              disabled={busy || comment.state === "dismissed"}
                              onClick={() =>
                                void updateCommentState(question, comment.id, "dismissed")
                              }
                              type="button"
                            >
                              {comment.state === "dismissed" ? "Dismissed" : "Dismiss"}
                            </button>
                          </div>
                          {commentRevisionMessages[comment.id] && (
                            <p className="simple-comment-notice" role="status">
                              {commentRevisionMessages[comment.id]}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </aside>
                </div>
                {reviewResult.suggestedAnswer && (
                  <div className="simple-answer-comparison">
                    <div>
                      <h4>Original</h4>
                      <p>{reviewResult.answerSnapshot}</p>
                    </div>
                    <div>
                      <h4>Suggested version</h4>
                      <p className="simple-suggestion-note">
                        This is a complete rewrite using only the facts already in your answer. Safe
                        comment-level replacements are included; comments asking for missing
                        evidence still need your input.
                      </p>
                      <label htmlFor={`suggested-${question.id}`}>
                        Suggested answer — edit before accepting
                      </label>
                      <textarea
                        id={`suggested-${question.id}`}
                        onChange={(event) =>
                          setSuggestedDrafts((current) => ({
                            ...current,
                            [reviewResult.id]: event.target.value,
                          }))
                        }
                        rows={10}
                        value={suggestedDrafts[reviewResult.id] ?? reviewResult.suggestedAnswer}
                      />
                      <div className="simple-suggestion-actions">
                        <button
                          className="button-secondary"
                          onClick={() =>
                            applySuggested(
                              question.id,
                              suggestedDrafts[reviewResult.id] ?? reviewResult.suggestedAnswer!,
                            )
                          }
                          type="button"
                        >
                          Use in my answer
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            const suggestion =
                              suggestedDrafts[reviewResult.id] ?? reviewResult.suggestedAnswer!;
                            setDrafts((current) => ({ ...current, [question.id]: suggestion }));
                            void save(question, false, suggestion);
                          }}
                          type="button"
                        >
                          Accept and save draft
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
            {reviewHistoryLoading[question.id] && !reviewResult && (
              <p className="simple-history-loading" role="status">
                Loading saved reviews…
              </p>
            )}
            <div className="simple-question-completion">
              <span>
                {answer?.ready
                  ? "This answer is marked prepared. Edit it to continue improving."
                  : "Finished reviewing and editing? Mark this answer prepared."}
              </span>
              {answer?.ready ? (
                <strong>✓ Prepared</strong>
              ) : (
                <button
                  disabled={busy || !draft.trim()}
                  onClick={() => void save(question, true)}
                  type="button"
                >
                  Mark prepared
                </button>
              )}
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      <header className="simple-answer-bank-header">
        <p className="eyebrow">Answer Bank</p>
        <h1>Prepare your interview answers</h1>
        <p>
          Choose a question, write your answer and improve it. Nothing is changed unless you accept
          it.
        </p>
        <strong>
          {prepared} of {questions.length} prepared
        </strong>
      </header>
      <section className="simple-question-section" aria-labelledby="start-questions">
        <div>
          <p className="eyebrow">Start here</p>
          <h2 id="start-questions">Introduction and the three whys</h2>
        </div>
        <ol className="simple-question-list">
          {introduction.map((question, index) => renderQuestion(question, index + 1))}
        </ol>
      </section>
      <section className="simple-question-section" aria-labelledby="competency-questions">
        <div>
          <p className="eyebrow">Use STAR</p>
          <h2 id="competency-questions">10 competency questions</h2>
        </div>
        <ol className="simple-question-list">
          {competency.map((question, index) =>
            renderQuestion(question, introduction.length + index + 1),
          )}
        </ol>
      </section>
      <p className="simple-usage-note">
        {Math.max(0, usage.monthlyLimit - usage.monthlyUsed)} answer reviews remain this month.
      </p>
    </>
  );
}
