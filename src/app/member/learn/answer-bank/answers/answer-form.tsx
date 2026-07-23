"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { questionFamilies } from "../../../../../modules/answer-bank/domain/answer-bank";
import { recruitmentStages } from "../../../../../modules/applications/domain/application";
import type {
  Answer,
  Question,
  Story,
} from "../../../../../modules/answer-bank/infrastructure/answer-bank-repository";
import type { TrackedApplication } from "../../../../../modules/applications/infrastructure/application-repository";
export function AnswerForm({
  initial,
  questions,
  stories,
  applications,
  selectedQuestion,
}: {
  initial?: Answer;
  questions: Question[];
  stories: readonly Story[];
  applications: readonly TrackedApplication[];
  selectedQuestion?: string;
}) {
  const router = useRouter(),
    summary = useRef<HTMLDivElement>(null);
  const selected = questions.find((q) => q.id === (initial?.questionId ?? selectedQuestion));
  const [custom, setCustom] = useState(Boolean(initial?.customQuestion));
  const [errors, setErrors] = useState<Record<string, string[]>>({}),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  async function submit(form: HTMLFormElement, ready: boolean) {
    setPending(true);
    setMessage("");
    setErrors({});
    const d = new FormData(form),
      body = {
        questionId: custom ? null : d.get("questionId"),
        customQuestion: custom ? d.get("customQuestion") : null,
        questionFamily: d.get("questionFamily"),
        title: d.get("title"),
        keyPoints: d.get("keyPoints"),
        draftAnswer: d.get("draftAnswer"),
        applicationId: d.get("applicationId"),
        recruitmentStage: d.get("recruitmentStage"),
        storyIds: d.getAll("storyIds"),
        ready,
        ...(initial ? { version: initial.version } : {}),
      };
    try {
      const r = await fetch(
          initial
            ? `/api/member/answer-bank/answers/${initial.id}`
            : "/api/member/answer-bank/answers",
          {
            method: initial ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        x = await r.json();
      if (!r.ok) {
        setErrors(x.errors ?? {});
        setMessage(
          r.status === 409
            ? "This answer changed elsewhere. Reload it before saving."
            : "Check the highlighted fields.",
        );
        summary.current?.focus();
        return;
      }
      router.push(`/member/learn/answer-bank/answers/${x.item.id}`);
      router.refresh();
    } catch {
      setMessage("We could not save this answer. Please try again.");
      summary.current?.focus();
    } finally {
      setPending(false);
    }
  }
  async function archive() {
    if (!initial) return;
    setPending(true);
    const response = await fetch(`/api/member/answer-bank/answers/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archive: true, version: initial.version }),
    });
    if (response.ok) router.push("/member/learn/answer-bank/answers");
    else {
      setMessage("We could not archive this answer. Reload and try again.");
      summary.current?.focus();
    }
    setPending(false);
  }
  return (
    <form
      className="card guided-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget, false);
      }}
    >
      {message && (
        <div role="alert" tabIndex={-1} ref={summary} className="error-summary">
          <p>{message}</p>
          <ul>
            {Object.values(errors)
              .flat()
              .map((x) => (
                <li key={x}>{x}</li>
              ))}
          </ul>
        </div>
      )}
      <section>
        <h2>Question</h2>
        <fieldset>
          <legend>Start from</legend>
          <label className="choice">
            <input type="radio" name="source" checked={!custom} onChange={() => setCustom(false)} />
            Core Interview Question
          </label>
          <label className="choice">
            <input type="radio" name="source" checked={custom} onChange={() => setCustom(true)} />
            Custom question
          </label>
        </fieldset>
        {custom ? (
          <>
            <label htmlFor="customQuestion">Custom question</label>
            <textarea
              id="customQuestion"
              name="customQuestion"
              maxLength={1000}
              defaultValue={initial?.customQuestion ?? ""}
            />
          </>
        ) : (
          <>
            <label htmlFor="questionId">Core Interview Question</label>
            <select
              id="questionId"
              name="questionId"
              defaultValue={initial?.questionId ?? selectedQuestion ?? ""}
            >
              <option value="">Choose a question</option>
              {questions.map((q) => (
                <option value={q.id} key={q.id}>
                  {q.prompt}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor="questionFamily">Question family</label>
        <select
          id="questionFamily"
          name="questionFamily"
          defaultValue={initial?.questionFamily ?? selected?.family ?? "personal_introduction"}
        >
          {Object.entries(questionFamilies).map(([k, l]) => (
            <option value={k} key={k}>
              {l}
            </option>
          ))}
        </select>
        <label htmlFor="title">Answer label</label>
        <input
          id="title"
          name="title"
          maxLength={160}
          defaultValue={initial?.title ?? selected?.prompt ?? ""}
        />
      </section>
      <section>
        <h2>
          Application context <span className="optional">Optional</span>
        </h2>
        <label htmlFor="applicationId">Application</label>
        <select id="applicationId" name="applicationId" defaultValue={initial?.applicationId ?? ""}>
          <option value="">Reusable across applications</option>
          {applications.map((a) => (
            <option value={a.id} key={a.id}>
              {a.company} — {a.role}
            </option>
          ))}
        </select>
        <label htmlFor="recruitmentStage">Recruitment stage</label>
        <select
          id="recruitmentStage"
          name="recruitmentStage"
          defaultValue={initial?.recruitmentStage ?? ""}
        >
          <option value="">Not specified</option>
          {Object.entries(recruitmentStages).map(([k, l]) => (
            <option value={k} key={k}>
              {l}
            </option>
          ))}
        </select>
      </section>
      <section>
        <h2>Build your answer</h2>
        <label htmlFor="keyPoints">Key points</label>
        <p className="hint" id="keyPoints-hint">
          Capture the points you do not want to miss.
        </p>
        <textarea
          id="keyPoints"
          name="keyPoints"
          rows={5}
          maxLength={4000}
          defaultValue={initial?.keyPoints}
        />
        <label htmlFor="draftAnswer">Draft answer</label>
        <textarea
          id="draftAnswer"
          name="draftAnswer"
          rows={10}
          maxLength={12000}
          defaultValue={initial?.draftAnswer}
        />
      </section>
      <section>
        <h2>Evidence stories</h2>
        <fieldset>
          <legend>Link reusable stories</legend>
          <div className="choice-grid">
            {stories.map((s) => (
              <label className="choice" key={s.id}>
                <input
                  type="checkbox"
                  name="storyIds"
                  value={s.id}
                  defaultChecked={initial?.storyIds.includes(s.id)}
                />
                {s.title} — {s.ready ? "Ready" : "Draft"}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <section>
        <h2>Readiness</h2>
        <div className="form-actions">
          <button disabled={pending}>Save as Draft</button>
          <button
            className="button-secondary"
            disabled={pending}
            type="button"
            onClick={(e) => void submit(e.currentTarget.form!, true)}
          >
            Mark Ready
          </button>
          {initial && (
            <button
              className="button-danger"
              disabled={pending}
              type="button"
              onClick={() => void archive()}
            >
              Archive answer
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
