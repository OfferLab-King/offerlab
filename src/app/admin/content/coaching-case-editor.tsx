"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  coachingCaseCategories,
  coachingCaseDetailSchema,
  type CoachingCaseDetail,
} from "../../../modules/preparation-resources/domain/coaching-case";

type Change = CoachingCaseDetail["changes"][number];

function rebuild(original: string, changes: readonly Change[]) {
  let cursor = 0;
  let improved = "";
  for (const change of [...changes].sort((a, b) => a.start - b.start)) {
    improved += original.slice(cursor, change.start) + change.replacement;
    cursor = change.end;
  }
  return improved + original.slice(cursor);
}

export function CoachingCaseEditor({
  detail,
  onPreviewChange,
  sourceKind,
}: {
  detail?: CoachingCaseDetail | null | undefined;
  onPreviewChange?: (detail: CoachingCaseDetail | null) => void;
  sourceKind?: "synthetic" | "anonymised_approved" | null | undefined;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [question, setQuestion] = useState(detail?.question ?? "");
  const [original, setOriginal] = useState(detail?.originalAnswer ?? "");
  const [changes, setChanges] = useState<Change[]>(detail ? [...detail.changes] : []);
  const [weaknesses, setWeaknesses] = useState(detail?.keyWeaknesses.join("\n") ?? "");
  const [whyStronger, setWhyStronger] = useState(detail?.whyStronger ?? "");
  const [practicePrompt, setPracticePrompt] = useState(detail?.practicePrompt ?? "");
  const [selectedSourceKind, setSelectedSourceKind] = useState(sourceKind ?? "synthetic");
  const [message, setMessage] = useState("");
  const improved = useMemo(() => rebuild(original, changes), [changes, original]);
  const payload = {
    changes,
    improvedAnswer: improved,
    keyWeaknesses: weaknesses
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean),
    originalAnswer: original,
    practicePrompt,
    question,
    whyStronger,
  };
  const valid = coachingCaseDetailSchema.safeParse(payload).success;
  const serializedPayload = valid ? JSON.stringify(payload) : "";

  useEffect(() => {
    onPreviewChange?.(
      serializedPayload
        ? coachingCaseDetailSchema.parse(JSON.parse(serializedPayload) as unknown)
        : null,
    );
  }, [onPreviewChange, serializedPayload]);

  function updateChange(id: string, patch: Partial<Change>) {
    setChanges((current) =>
      current.map((change) => (change.id === id ? { ...change, ...patch } : change)),
    );
  }

  function addComment() {
    const input = textarea.current;
    if (!input || input.selectionStart === input.selectionEnd) {
      setMessage("Select the exact words you want to comment on first.");
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (changes.some((change) => start < change.end && end > change.start)) {
      setMessage("That selection overlaps an existing comment. Select a separate passage.");
      return;
    }
    const id = `comment_${Date.now().toString(36)}`;
    setChanges((current) =>
      [
        ...current,
        {
          category: "Evidence" as const,
          end,
          explanation: "",
          heading: "",
          id,
          replacement: original.slice(start, end),
          start,
        },
      ].sort((a, b) => a.start - b.start),
    );
    setMessage("Comment added. Add the coaching explanation and revised wording below.");
  }

  function changeOriginal(value: string) {
    setOriginal(value);
    if (changes.length) {
      setChanges([]);
      setMessage(
        "The original answer changed, so its old text selections were cleared. Add comments again against the revised original.",
      );
    }
  }

  return (
    <section className="cms-case-editor" aria-labelledby="case-editor-title">
      <div className="cms-section-heading">
        <div>
          <p className="eyebrow">Coaching case</p>
          <h2 id="case-editor-title">Build the annotated before-and-after</h2>
          <p>
            Select wording in the original answer, add a coach comment, then enter the stronger
            replacement.
          </p>
        </div>
        <span className={`cms-completeness ${valid ? "is-complete" : ""}`}>
          {valid ? "Ready to save" : "Needs more detail"}
        </span>
      </div>
      <input name="coachingCaseDetail" type="hidden" value={serializedPayload} />
      <div className="cms-case-source">
        <label>
          Source
          <select
            name="coachingCaseSourceKind"
            onChange={(event) =>
              setSelectedSourceKind(event.target.value as typeof selectedSourceKind)
            }
            value={selectedSourceKind}
          >
            <option value="synthetic">Synthetic teaching example</option>
            <option value="anonymised_approved">Anonymised and approved previous work</option>
          </select>
        </label>
        {selectedSourceKind === "anonymised_approved" ? (
          <label className="cms-confirmation">
            <input
              defaultChecked={sourceKind === "anonymised_approved"}
              name="anonymisationConfirmed"
              type="checkbox"
              value="yes"
            />
            <span>
              I confirm this material is authorised, fully anonymised and contains no
              employer-private information.
            </span>
          </label>
        ) : (
          <p className="cms-source-note">
            Synthetic examples must not contain real student or employer-private information.
          </p>
        )}
      </div>
      <label>
        Interview question
        <textarea
          maxLength={1000}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Tell me about a time you worked effectively in a team."
          rows={2}
          value={question}
        />
      </label>
      <div className="cms-case-workspace">
        <div>
          <label>
            Original answer
            <textarea
              aria-describedby="selection-help"
              maxLength={8000}
              onChange={(event) => changeOriginal(event.target.value)}
              placeholder="Paste the anonymised original answer here."
              ref={textarea}
              rows={12}
              value={original}
            />
          </label>
          <div className="cms-selection-action">
            <p id="selection-help">Highlight a sentence or phrase in the answer above.</p>
            <button
              className="button-secondary"
              disabled={!original}
              onClick={addComment}
              type="button"
            >
              Add comment to selection
            </button>
          </div>
          {message && (
            <p className="status" role="status">
              {message}
            </p>
          )}
        </div>
        <div className="cms-case-preview" aria-label="Tracked changes preview">
          <p className="case-document-label">Live improved answer</p>
          <p>{improved || "The improved answer will appear as you add replacements."}</p>
        </div>
      </div>
      <div className="cms-comment-editor-list">
        {changes.length === 0 ? (
          <div className="cms-empty-inline">
            <h3>No coach comments yet</h3>
            <p>Select wording in the original answer to create the first comment.</p>
          </div>
        ) : (
          changes.map((change, index) => (
            <fieldset className="cms-comment-editor" key={change.id}>
              <legend>Comment {index + 1}</legend>
              <p className="cms-selected-quote">“{original.slice(change.start, change.end)}”</p>
              <div className="cms-field-grid">
                <label>
                  Category
                  <select
                    onChange={(event) =>
                      updateChange(change.id, {
                        category: event.target.value as Change["category"],
                      })
                    }
                    value={change.category}
                  >
                    {coachingCaseCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Short heading
                  <input
                    maxLength={120}
                    onChange={(event) => updateChange(change.id, { heading: event.target.value })}
                    placeholder="Replace vague team language"
                    value={change.heading}
                  />
                </label>
              </div>
              <div className="cms-field-grid cms-comment-copy-grid">
                <label>
                  Coach explanation
                  <textarea
                    maxLength={800}
                    onChange={(event) =>
                      updateChange(change.id, { explanation: event.target.value })
                    }
                    placeholder="Explain why this wording is weak and what the student should notice."
                    rows={4}
                    value={change.explanation}
                  />
                </label>
                <label>
                  Replacement wording
                  <textarea
                    maxLength={1000}
                    onChange={(event) =>
                      updateChange(change.id, { replacement: event.target.value })
                    }
                    rows={4}
                    value={change.replacement}
                  />
                </label>
              </div>
              <button
                className="button-danger-outline"
                onClick={() =>
                  setChanges((current) => current.filter((item) => item.id !== change.id))
                }
                type="button"
              >
                Remove comment
              </button>
            </fieldset>
          ))
        )}
      </div>
      <div className="cms-field-grid">
        <label>
          Common mistakes <span className="hint">One per line</span>
          <textarea
            maxLength={2000}
            onChange={(event) => setWeaknesses(event.target.value)}
            rows={5}
            value={weaknesses}
          />
        </label>
        <label>
          Why the revised answer is stronger
          <textarea
            maxLength={2000}
            onChange={(event) => setWhyStronger(event.target.value)}
            rows={5}
            value={whyStronger}
          />
        </label>
      </div>
      <label>
        Practice prompt
        <textarea
          maxLength={1000}
          onChange={(event) => setPracticePrompt(event.target.value)}
          rows={3}
          value={practicePrompt}
        />
      </label>
    </section>
  );
}
