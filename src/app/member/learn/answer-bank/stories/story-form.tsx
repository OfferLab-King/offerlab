"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  competencies,
  experienceTypes,
  type StoryValues,
} from "../../../../../modules/answer-bank/domain/answer-bank";
import type { Story } from "../../../../../modules/answer-bank/infrastructure/answer-bank-repository";
const empty: StoryValues = {
  title: "",
  experienceType: "education",
  situation: "",
  task: "",
  actions: "",
  reasoning: "",
  result: "",
  reflection: "",
  summary: null,
  competencies: [],
  ready: false,
};
const sections = [
  ["situation", "Situation", "Give only the context needed to understand the example.", 3000],
  ["task", "Task", "Describe what you needed to achieve.", 3000],
  ["actions", "Actions", "Focus on what you personally did.", 6000],
  ["reasoning", "Reasoning", "Explain why you chose those actions.", 4000],
  ["result", "Result", "Use evidence where available.", 4000],
  ["reflection", "Reflection", "Explain what you learned or would improve.", 4000],
] as const;
export function StoryForm({ initial }: { initial?: Story }) {
  const router = useRouter(),
    summary = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({}),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  async function submit(form: HTMLFormElement, ready: boolean) {
    setPending(true);
    setErrors({});
    setMessage("");
    const d = new FormData(form),
      body = {
        title: d.get("title"),
        experienceType: d.get("experienceType"),
        situation: d.get("situation"),
        task: d.get("task"),
        actions: d.get("actions"),
        reasoning: d.get("reasoning"),
        result: d.get("result"),
        reflection: d.get("reflection"),
        summary: d.get("summary"),
        competencies: d.getAll("competencies"),
        ready,
        ...(initial ? { version: initial.version } : {}),
      };
    try {
      const r = await fetch(
          initial
            ? `/api/member/answer-bank/stories/${initial.id}`
            : "/api/member/answer-bank/stories",
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
            ? "This story changed elsewhere. Reload it before saving."
            : "Check the highlighted fields.",
        );
        summary.current?.focus();
        return;
      }
      router.push(`/member/learn/answer-bank/stories/${x.item.id}`);
      router.refresh();
    } catch {
      setMessage("We could not save this story. Please try again.");
      summary.current?.focus();
    } finally {
      setPending(false);
    }
  }
  async function changeArchive() {
    if (!initial) return;
    setPending(true);
    const response = await fetch(`/api/member/answer-bank/stories/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archive: !initial.archivedAt, version: initial.version }),
    });
    if (response.ok)
      router.push(
        initial.archivedAt
          ? "/member/learn/answer-bank/stories"
          : "/member/learn/answer-bank/stories?view=archived",
      );
    else {
      setMessage(
        `We could not ${initial.archivedAt ? "restore" : "archive"} this story. Reload and try again.`,
      );
      summary.current?.focus();
    }
    setPending(false);
  }
  if (initial?.archivedAt)
    return (
      <section className="card archived-item" aria-labelledby="archived-story-title">
        <span className="status-badge">Archived</span>
        <h2 id="archived-story-title">This story is archived</h2>
        <p>Restore it before using it as active interview preparation.</p>
        {message && (
          <p className="error-summary" role="alert">
            {message}
          </p>
        )}
        <button disabled={pending} type="button" onClick={() => void changeArchive()}>
          Restore story
        </button>
      </section>
    );
  const v = initial ?? empty;
  return (
    <form
      className="card guided-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget, false);
      }}
    >
      {message && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summary}>
          <p>{message}</p>
          <ul>
            {Object.entries(errors).map(([k, x]) => (
              <li key={k}>
                <a href={`#${k}`}>{x[0]}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <section>
        <h2>1. Story basics</h2>
        <label htmlFor="title">
          Story title <span className="required">Required</span>
        </label>
        <input
          id="title"
          name="title"
          maxLength={160}
          defaultValue={v.title}
          aria-invalid={Boolean(errors.title)}
        />
        <label htmlFor="experienceType">Experience type</label>
        <select id="experienceType" name="experienceType" defaultValue={v.experienceType}>
          {Object.entries(experienceTypes).map(([k, l]) => (
            <option value={k} key={k}>
              {l}
            </option>
          ))}
        </select>
      </section>
      {sections.map(([key, label, hint, max], i) => (
        <section key={key}>
          <h2>
            {i + 2}. {label}
          </h2>
          <label htmlFor={key}>{label}</label>
          <p className="hint" id={`${key}-hint`}>
            {hint}
          </p>
          <textarea
            id={key}
            name={key}
            rows={5}
            maxLength={max}
            defaultValue={v[key]}
            aria-describedby={`${key}-hint`}
            aria-invalid={Boolean(errors[key])}
          />
        </section>
      ))}
      <section>
        <h2>8. Competencies</h2>
        <fieldset aria-invalid={Boolean(errors.competencies)} id="competencies">
          <legend>Which competencies does this story demonstrate?</legend>
          <div className="choice-grid">
            {Object.entries(competencies).map(([k, l]) => (
              <label className="choice" key={k}>
                <input
                  type="checkbox"
                  name="competencies"
                  value={k}
                  defaultChecked={v.competencies.includes(k as keyof typeof competencies)}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <section>
        <h2>9. Readiness</h2>
        <p>
          Save as Draft at any time, or mark Ready once every section and at least one competency
          are complete.
        </p>
        <div className="form-actions">
          <button disabled={pending} type="submit">
            Save as Draft
          </button>
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
              onClick={() => void changeArchive()}
            >
              Archive story
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
