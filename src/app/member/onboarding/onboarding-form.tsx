"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  confidenceLevels,
  educationStages,
  industries,
  opportunityTypes,
  preparationPriorities,
  supportNeeds,
  type OnboardingAnswers,
  type OnboardingFieldErrors,
  type OnboardingField,
  type OnboardingIntent,
} from "../../../modules/member-profile/domain/onboarding";

type Props = Readonly<{
  initial: OnboardingAnswers;
  initiallyCompleted: boolean;
}>;

const firstControlByField: Partial<Record<OnboardingField, string>> = {
  confidence: "confidence-building",
  educationStage: "educationStage-undergraduate",
  industries: "industries-consulting",
  opportunityTypes: "opportunityTypes-graduate_scheme",
  preparationPriorities: "preparationPriorities-application_cv",
  supportNeeds: "supportNeeds-structured_plan",
  targetCompanies: "targetCompanies",
};

function invalidState(invalid: boolean): Readonly<{ "aria-invalid": boolean }> {
  return { "aria-invalid": invalid };
}

function CheckboxGroup({
  description,
  error,
  label,
  name,
  options,
  selected,
}: Readonly<{
  description: string;
  error: readonly string[] | undefined;
  label: string;
  name: string;
  options: Readonly<Record<string, string>>;
  selected: readonly string[];
}>) {
  const describedBy = `${name}-description${error ? ` ${name}-error` : ""}`;
  return (
    <fieldset aria-describedby={describedBy} aria-invalid={Boolean(error)} id={`${name}-group`}>
      <legend>{label}</legend>
      <p className="hint" id={`${name}-description`}>
        {description}
      </p>
      <div className="choice-grid">
        {Object.entries(options).map(([value, optionLabel]) => (
          <label className="choice" key={value}>
            <input
              defaultChecked={selected.includes(value)}
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              id={`${name}-${value}`}
              name={name}
              type="checkbox"
              value={value}
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="field-error" id={`${name}-error`}>
          <span aria-hidden="true">Issue: </span>
          {error[0]}
        </p>
      )}
    </fieldset>
  );
}

export function OnboardingForm({ initial, initiallyCompleted }: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<OnboardingFieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [summaryFocusRequest, setSummaryFocusRequest] = useState(0);
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summaryFocusRequest > 0) errorSummary.current?.focus();
  }, [summaryFocusRequest]);

  function clearFieldError(field: string): void {
    if (!(field in errors)) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[field as OnboardingField];
      if (Object.keys(next).length === 0) {
        setSubmissionFailed(false);
        setMessage("");
      }
      return next;
    });
  }

  async function submit(form: HTMLFormElement, intent: OnboardingIntent) {
    setPending(true);
    setErrors({});
    setMessage("");
    setSubmissionFailed(false);
    const data = new FormData(form);
    const targetCompanies = String(data.get("targetCompanies") ?? "")
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const body = {
      confidence: data.get("confidence") || null,
      educationStage: data.get("educationStage") || null,
      industries: data.getAll("industries"),
      intent,
      opportunityTypes: data.getAll("opportunityTypes"),
      preparationPriorities: data.getAll("preparationPriorities"),
      supportNeeds: data.getAll("supportNeeds"),
      targetCompanies,
    };
    try {
      const response = await fetch("/api/member/onboarding", {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const result = (await response.json()) as {
        completed?: boolean;
        errors?: OnboardingFieldErrors;
        message?: string;
        outcome?: string;
      };
      if (!response.ok) {
        setErrors(result.errors ?? {});
        setMessage(
          result.errors ? "Check the highlighted fields." : (result.message ?? "Save failed."),
        );
        setSubmissionFailed(true);
        setSummaryFocusRequest((current) => current + 1);
        return;
      }
      setCompleted(Boolean(result.completed));
      if (result.outcome === "completed") {
        router.push("/member");
        return;
      }
      setMessage(
        result.outcome === "unchanged"
          ? "Your profile is already up to date."
          : result.outcome === "updated"
            ? "Your onboarding profile changes have been saved."
            : "Your progress has been saved. You can return at any time.",
      );
    } catch {
      setMessage("We could not save your onboarding profile. Please try again.");
      setSubmissionFailed(true);
      setSummaryFocusRequest((current) => current + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onChange={(event) => {
        const control = event.target as unknown as HTMLInputElement | HTMLTextAreaElement;
        clearFieldError(control.name);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget, "complete");
      }}
    >
      {message &&
        (submissionFailed ? (
          <div
            aria-live="assertive"
            className="error-summary"
            id="onboarding-error-summary"
            ref={errorSummary}
            role="alert"
            tabIndex={-1}
          >
            <p>
              <strong>There is a problem</strong>
            </p>
            <p>{message}</p>
            {Object.entries(errors).length > 0 && (
              <ul>
                {Object.entries(errors).map(([field, fieldErrors]) => (
                  <li key={field}>
                    <a href={`#${firstControlByField[field as OnboardingField] ?? field}`}>
                      {fieldErrors?.[0]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p aria-live="polite" className="status" role="status">
            {message}
          </p>
        ))}

      <section className="form-section" aria-labelledby="essentials-heading">
        <div>
          <p className="step-label">Required</p>
          <h2 id="essentials-heading">Your graduate search</h2>
          <p>These answers give OfferLab enough context to guide your next stage.</p>
        </div>

        <fieldset
          aria-describedby={errors.educationStage ? "educationStage-error" : undefined}
          aria-invalid={Boolean(errors.educationStage)}
          id="educationStage-group"
        >
          <legend>Education or career stage</legend>
          <div className="choice-grid">
            {Object.entries(educationStages).map(([value, label]) => (
              <label className="choice" key={value}>
                <input
                  defaultChecked={initial.educationStage === value}
                  aria-describedby={errors.educationStage ? "educationStage-error" : undefined}
                  id={`educationStage-${value}`}
                  name="educationStage"
                  type="radio"
                  value={value}
                  {...invalidState(Boolean(errors.educationStage))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {errors.educationStage && (
            <p className="field-error" id="educationStage-error">
              <span aria-hidden="true">Issue: </span>
              {errors.educationStage[0]}
            </p>
          )}
        </fieldset>

        <CheckboxGroup
          description="Choose all that apply."
          error={errors.opportunityTypes}
          label="Opportunity types"
          name="opportunityTypes"
          options={opportunityTypes}
          selected={initial.opportunityTypes}
        />
        <CheckboxGroup
          description="Choose up to eight."
          error={errors.industries}
          label="Target industries"
          name="industries"
          options={industries}
          selected={initial.industries}
        />
        <CheckboxGroup
          description="Choose what you most want to work on."
          error={errors.preparationPriorities}
          label="Preparation priorities"
          name="preparationPriorities"
          options={preparationPriorities}
          selected={initial.preparationPriorities}
        />
      </section>

      <section className="form-section" aria-labelledby="optional-heading">
        <div>
          <p className="step-label">Optional</p>
          <h2 id="optional-heading">A little more context</h2>
          <p>Skip anything you would rather not answer. You can update this later.</p>
        </div>

        <label htmlFor="targetCompanies">Target companies</label>
        <p className="hint" id="targetCompanies-hint">
          Up to 10 names, separated by commas or new lines.
        </p>
        <textarea
          aria-describedby={`targetCompanies-hint${errors.targetCompanies ? " targetCompanies-error" : ""}`}
          aria-invalid={Boolean(errors.targetCompanies)}
          defaultValue={initial.targetCompanies.join("\n")}
          id="targetCompanies"
          maxLength={809}
          name="targetCompanies"
          rows={4}
        />
        {errors.targetCompanies && (
          <p className="field-error" id="targetCompanies-error">
            <span aria-hidden="true">Issue: </span>
            {errors.targetCompanies[0]}
          </p>
        )}

        <CheckboxGroup
          description="Choose any support that would be useful."
          error={errors.supportNeeds}
          label="Support needs"
          name="supportNeeds"
          options={supportNeeds}
          selected={initial.supportNeeds}
        />

        <fieldset
          aria-describedby={`confidence-hint${errors.confidence ? " confidence-error" : ""}`}
          aria-invalid={Boolean(errors.confidence)}
          id="confidence-group"
        >
          <legend>Overall confidence</legend>
          <p className="hint" id="confidence-hint">
            Choose one if you would like to.
          </p>
          <div className="choice-grid">
            {Object.entries(confidenceLevels).map(([value, label]) => (
              <label className="choice" key={value}>
                <input
                  defaultChecked={initial.confidence === value}
                  aria-describedby={`confidence-hint${errors.confidence ? " confidence-error" : ""}`}
                  id={`confidence-${value}`}
                  name="confidence"
                  type="radio"
                  value={value}
                  {...invalidState(Boolean(errors.confidence))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {errors.confidence && (
            <p className="field-error" id="confidence-error">
              <span aria-hidden="true">Issue: </span>
              {errors.confidence[0]}
            </p>
          )}
        </fieldset>
      </section>

      <div className="form-actions">
        <button disabled={pending} type="submit">
          {pending ? "Saving…" : completed ? "Update profile" : "Complete onboarding"}
        </button>
        {!completed && (
          <button
            className="button-secondary"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void submit(event.currentTarget.form!, "save");
            }}
            type="button"
          >
            Save and finish later
          </button>
        )}
      </div>
    </form>
  );
}
