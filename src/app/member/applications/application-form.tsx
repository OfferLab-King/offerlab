"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  recruitmentStages,
  type ApplicationField,
  type ApplicationFieldErrors,
  type ApplicationValues,
} from "../../../modules/applications/domain/application";
import { applicationFormRequestBody } from "../../../modules/applications/application/request";
import { opportunityTypes } from "../../../modules/taxonomy/domain/opportunity-types";
import { industries } from "../../../modules/taxonomy/domain/industries";
import { EmployerCompanyField } from "./employer-company-field";

type Props = Readonly<{
  applicationId?: string;
  archived?: boolean;
  initial?: ApplicationValues;
  version?: number;
}>;

const empty: ApplicationValues = {
  appliedDate: null,
  applicationDeadline: null,
  company: "",
  companyId: null,
  industry: null,
  location: null,
  nextStageDeadline: null,
  notes: null,
  opportunityType: "graduate_scheme",
  role: "",
  stage: "preparing",
};

const labels: Record<ApplicationField, string> = {
  appliedDate: "Applied date",
  applicationDeadline: "Application deadline",
  company: "Company",
  companyId: "Company",
  industry: "Industry",
  location: "Location",
  nextStageDeadline: "Next-stage deadline",
  notes: "Notes",
  opportunityType: "Opportunity type",
  role: "Role",
  stage: "Current recruitment stage",
  version: "Application version",
};

export function ApplicationForm({
  applicationId,
  archived = false,
  initial = empty,
  version,
}: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<ApplicationFieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [summaryFocusRequest, setSummaryFocusRequest] = useState(0);
  const summary = useRef<HTMLDivElement>(null);
  const archiveTrigger = useRef<HTMLButtonElement>(null);
  const archiveConfirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (summaryFocusRequest > 0) summary.current?.focus();
  }, [summaryFocusRequest]);

  useEffect(() => {
    if (confirmingArchive) archiveConfirm.current?.focus();
  }, [confirmingArchive]);

  function clearError(field: string) {
    setErrors((current) => {
      const next = { ...current };
      delete next[field as ApplicationField];
      return next;
    });
  }

  async function submit(form: HTMLFormElement) {
    setPending(true);
    setErrors({});
    setMessage("");
    setConflict(false);
    try {
      const response = await fetch(
        applicationId ? `/api/member/applications/${applicationId}` : "/api/member/applications",
        {
          body: JSON.stringify(applicationFormRequestBody(new FormData(form), version)),
          headers: { "content-type": "application/json" },
          method: applicationId ? "PUT" : "POST",
        },
      );
      const result = (await response.json()) as {
        application?: { id: string };
        errors?: ApplicationFieldErrors;
        message?: string;
        outcome?: string;
      };
      if (response.status === 409) {
        setConflict(true);
        setMessage("This application changed elsewhere. Reload it before making more changes.");
        setSummaryFocusRequest((current) => current + 1);
        return;
      }
      if (!response.ok) {
        setErrors(result.errors ?? {});
        setMessage(
          result.errors ? "Check the highlighted fields." : (result.message ?? "Save failed."),
        );
        setSummaryFocusRequest((current) => current + 1);
        return;
      }
      if (!applicationId && result.application?.id) {
        router.push(`/member/applications/${result.application.id}`);
        return;
      }
      setMessage(
        result.outcome === "unchanged"
          ? "This application is already up to date."
          : "Application saved.",
      );
      router.refresh();
    } catch {
      setMessage("We could not save this application. Please try again.");
      setSummaryFocusRequest((current) => current + 1);
    } finally {
      setPending(false);
    }
  }

  async function changeArchive() {
    if (!applicationId || version === undefined) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/member/applications/${applicationId}/archive`, {
        body: JSON.stringify({ archive: !archived, version }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (response.status === 409) {
        setConflict(true);
        setMessage("This application changed elsewhere. Reload it before making more changes.");
        setSummaryFocusRequest((current) => current + 1);
        return;
      }
      if (!response.ok) throw new Error("archive_failed");
      router.push(archived ? "/member/applications" : "/member/applications?view=archived");
    } catch {
      setMessage(
        `We could not ${archived ? "restore" : "archive"} this application. Please try again.`,
      );
      setSummaryFocusRequest((current) => current + 1);
    } finally {
      setPending(false);
    }
  }

  const describedBy = (field: ApplicationField, hint?: string) =>
    [hint, errors[field] ? `${field}-error` : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <form
      onChange={(event) => clearError((event.target as unknown as HTMLInputElement).name)}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      {message && (
        <div
          aria-live={conflict || Object.keys(errors).length ? "assertive" : "polite"}
          className={conflict || Object.keys(errors).length ? "error-summary" : "status"}
          id="application-error-summary"
          ref={summary}
          role={conflict || Object.keys(errors).length ? "alert" : "status"}
          tabIndex={-1}
        >
          <p>{message}</p>
          {Object.entries(errors).length > 0 && (
            <ul>
              {Object.entries(errors).map(([field, fieldErrors]) => (
                <li key={field}>
                  <a href={`#${field}`}>
                    {labels[field as ApplicationField]}: {fieldErrors?.[0]}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {conflict && (
            <button onClick={() => window.location.reload()} type="button">
              Reload application
            </button>
          )}
        </div>
      )}

      {archived && (
        <p className="status">This application is read-only. Restore it before making changes.</p>
      )}
      <fieldset className="application-fields" disabled={archived}>
        <legend className="sr-only">Application details</legend>
        <div className="form-grid">
          <div className="field-full">
            <label htmlFor="company">
              Company <span className="required">Required</span>
            </label>
            <EmployerCompanyField
              defaultCompanyId={initial.companyId}
              defaultValue={initial.company}
              describedBy={describedBy("company", "company-hint")}
              invalid={Boolean(errors.company)}
            />
            <p className="hint" id="company-hint">
              Start typing to pick a researched employer; otherwise enter any company name.
            </p>
            {errors.company && (
              <p className="field-error" id="company-error">
                {errors.company[0]}
              </p>
            )}
          </div>
          <div className="field-full">
            <label htmlFor="role">
              Role <span className="required">Required</span>
            </label>
            <input
              aria-describedby={describedBy("role")}
              aria-invalid={Boolean(errors.role)}
              defaultValue={initial.role}
              id="role"
              maxLength={160}
              name="role"
              required
            />
            {errors.role && (
              <p className="field-error" id="role-error">
                {errors.role[0]}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="opportunityType">
              Opportunity type <span className="required">Required</span>
            </label>
            <select
              aria-describedby={describedBy("opportunityType")}
              aria-invalid={Boolean(errors.opportunityType)}
              defaultValue={initial.opportunityType}
              id="opportunityType"
              name="opportunityType"
            >
              {Object.entries(opportunityTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.opportunityType && (
              <p className="field-error" id="opportunityType-error">
                {errors.opportunityType[0]}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="industry">
              Industry <span className="optional">Optional</span>
            </label>
            <select
              aria-describedby={describedBy("industry")}
              aria-invalid={Boolean(errors.industry)}
              defaultValue={initial.industry ?? ""}
              id="industry"
              name="industry"
            >
              <option value="">Not specified</option>
              {Object.entries(industries).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.industry && (
              <p className="field-error" id="industry-error">
                {errors.industry[0]}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="stage">
              Current recruitment stage <span className="required">Required</span>
            </label>
            <select
              aria-describedby={describedBy("stage")}
              aria-invalid={Boolean(errors.stage)}
              defaultValue={initial.stage}
              id="stage"
              name="stage"
            >
              {Object.entries(recruitmentStages).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.stage && (
              <p className="field-error" id="stage-error">
                {errors.stage[0]}
              </p>
            )}
          </div>
          <div className="field-full">
            <label htmlFor="location">
              Location <span className="optional">Optional</span>
            </label>
            <input
              aria-describedby={describedBy("location")}
              aria-invalid={Boolean(errors.location)}
              defaultValue={initial.location ?? ""}
              id="location"
              maxLength={120}
              name="location"
            />
            {errors.location && (
              <p className="field-error" id="location-error">
                {errors.location[0]}
              </p>
            )}
          </div>
          {(["applicationDeadline", "appliedDate", "nextStageDeadline"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={field}>
                {labels[field]} <span className="optional">Optional</span>
              </label>
              <input
                aria-describedby={describedBy(field)}
                aria-invalid={Boolean(errors[field])}
                defaultValue={initial[field] ?? ""}
                id={field}
                name={field}
                type="date"
              />
              {errors[field] && (
                <p className="field-error" id={`${field}-error`}>
                  {errors[field]?.[0]}
                </p>
              )}
            </div>
          ))}
          <div className="field-full">
            <label htmlFor="notes">
              Notes <span className="optional">Optional</span>
            </label>
            <p className="hint" id="notes-hint">
              Private to you. Up to 2,000 characters.
            </p>
            <textarea
              aria-describedby={describedBy("notes", "notes-hint")}
              aria-invalid={Boolean(errors.notes)}
              defaultValue={initial.notes ?? ""}
              id="notes"
              maxLength={2000}
              name="notes"
              rows={7}
            />
            {errors.notes && (
              <p className="field-error" id="notes-error">
                {errors.notes[0]}
              </p>
            )}
          </div>
        </div>
      </fieldset>
      <div className="form-actions">
        {!archived && (
          <button disabled={pending} type="submit">
            {pending ? "Saving…" : applicationId ? "Save changes" : "Save application"}
          </button>
        )}
        <Link className="button-link button-secondary" href="/member/applications">
          Cancel
        </Link>
        {applicationId && archived && (
          <button disabled={pending} onClick={() => void changeArchive()} type="button">
            Restore application
          </button>
        )}
        {applicationId && !archived && !confirmingArchive && (
          <button
            className="button-danger"
            disabled={pending}
            onClick={() => setConfirmingArchive(true)}
            ref={archiveTrigger}
            type="button"
          >
            Archive application
          </button>
        )}
      </div>
      {confirmingArchive && (
        <div
          aria-labelledby="archive-confirmation-title"
          className="archive-confirmation"
          role="alertdialog"
        >
          <h2 id="archive-confirmation-title">Archive this application?</h2>
          <p>You can restore it later from the archived applications view.</p>
          <div className="form-actions">
            <button
              className="button-danger"
              disabled={pending}
              onClick={() => void changeArchive()}
              ref={archiveConfirm}
              type="button"
            >
              Confirm archive
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setConfirmingArchive(false);
                requestAnimationFrame(() => archiveTrigger.current?.focus());
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
