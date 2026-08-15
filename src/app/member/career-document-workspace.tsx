"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { developmentRecommendations } from "../../modules/career-documents/domain/development-guidance";
import { careerEvidenceCoverage } from "../../modules/career-documents/domain/review";
import type {
  CareerDocumentVersion,
  CareerDocumentVersionSummary,
  CareerDocumentWorkspaceDocument,
  CareerJobTarget,
  StoredCareerReview,
} from "../../modules/career-documents/infrastructure/career-repository";

type Props = Readonly<{
  configuration: Readonly<{ modelAvailable: boolean; noticeVersion: string | null }>;
  document: CareerDocumentWorkspaceDocument;
  jobTargets: readonly CareerJobTarget[];
  membershipActive: boolean;
  reviews: readonly StoredCareerReview[];
  selectedVersion: CareerDocumentVersion;
  versionSummaries: readonly CareerDocumentVersionSummary[];
}>;

const versionFields = [
  "contentText",
  "jobDescription",
  "label",
  "targetCompany",
  "targetJobId",
  "targetRole",
] as const;
type VersionField = (typeof versionFields)[number];

const versionFieldMessages: Readonly<Record<VersionField, string>> = {
  contentText: "Keep the document text between 40 and 60,000 characters.",
  jobDescription: "Keep the job description within 30,000 characters.",
  label: "Enter a version name between 1 and 160 characters.",
  targetCompany: "Add the company when using a job description.",
  targetJobId: "Choose a valid saved job.",
  targetRole: "Add the role when using a job description.",
};

function isVersionField(value: string): value is VersionField {
  return versionFields.some((field) => field === value);
}

function versionDate(value: Date) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sameRequirement(left: string, right: string): boolean {
  return (
    left.toLowerCase().replace(/\s+/gu, " ").trim() ===
    right.toLowerCase().replace(/\s+/gu, " ").trim()
  );
}

export function CareerDocumentWorkspace({
  configuration,
  document,
  jobTargets,
  membershipActive,
  reviews,
  selectedVersion,
  versionSummaries,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = selectedVersion;
  const [label, setLabel] = useState(selected.label);
  const [contentText, setContentText] = useState(selected.contentText);
  const [targetJobId, setTargetJobId] = useState(selected.targetJobId ?? "");
  const [targetRole, setTargetRole] = useState(selected.targetRole ?? "");
  const [targetCompany, setTargetCompany] = useState(selected.targetCompany ?? "");
  const [jobDescription, setJobDescription] = useState(selected.jobDescription);
  const [modelConsent, setModelConsent] = useState(false);
  const [pending, setPending] = useState<"review" | "save" | null>(null);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<readonly VersionField[]>([]);
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLFormElement>(null);
  const latestReview = reviews[0];
  const coverage = latestReview ? careerEvidenceCoverage(latestReview) : null;
  const learning = latestReview ? developmentRecommendations(latestReview.missingRequirements) : [];
  const kindLabel = document.kind === "cv" ? "CV" : "cover letter";

  useEffect(() => {
    if (!dirty) return;
    let restoringHistory = false;
    let restoreTimer: number | undefined;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const warnBeforeHistoryNavigation = () => {
      if (restoringHistory) {
        restoringHistory = false;
        if (restoreTimer) window.clearTimeout(restoreTimer);
        return;
      }
      if (window.confirm("Discard this unsaved working copy and leave this page?")) return;
      restoringHistory = true;
      window.history.forward();
      restoreTimer = window.setTimeout(() => {
        restoringHistory = false;
      }, 1_000);
    };
    const warnBeforeLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      ) {
        return;
      }
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href
      ) {
        return;
      }
      if (!window.confirm("Discard this unsaved working copy and leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", warnBeforeHistoryNavigation);
    window.document.addEventListener("click", warnBeforeLinkNavigation, true);
    return () => {
      if (restoreTimer) window.clearTimeout(restoreTimer);
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", warnBeforeHistoryNavigation);
      window.document.removeEventListener("click", warnBeforeLinkNavigation, true);
    };
  }, [dirty]);

  function clearFieldError(field: VersionField) {
    setFieldErrors((current) => current.filter((candidate) => candidate !== field));
  }

  function hasFieldError(field: VersionField) {
    return fieldErrors.includes(field);
  }

  function describeField(field: VersionField) {
    return hasFieldError(field) ? `career-version-${field}-error` : undefined;
  }

  function chooseVersion(id: string) {
    if (!versionSummaries.some((version) => version.id === id) || id === selected.id) return;
    if (dirty && !window.confirm("Discard this unsaved working copy and open another version?")) {
      return;
    }
    router.push(`${pathname}?version=${encodeURIComponent(id)}` as Route);
  }

  function updateTarget(id: string) {
    clearFieldError("targetJobId");
    clearFieldError("targetCompany");
    clearFieldError("targetRole");
    clearFieldError("jobDescription");
    setTargetJobId(id);
    const target = jobTargets.find((candidate) => candidate.id === id);
    if (target) {
      setTargetRole(target.roleTitle);
      setTargetCompany(target.companyName);
      setJobDescription(target.description);
    }
    setDirty(true);
  }

  async function saveVersion(event: FormEvent) {
    event.preventDefault();
    setPending("save");
    setMessage("");
    setFieldErrors([]);
    try {
      const response = await fetch(`/api/member/career-documents/${document.id}/versions`, {
        body: JSON.stringify({
          contentText,
          jobDescription,
          label,
          targetCompany: targetCompany || null,
          targetJobId: targetJobId || null,
          targetRole: targetRole || null,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        fields?: string[];
        item?: { id: string };
        message?: string;
      };
      if (!response.ok) {
        const invalidFieldSet = new Set((result.fields ?? []).filter(isVersionField));
        if (jobDescription.trim()) {
          if (!targetCompany.trim()) invalidFieldSet.add("targetCompany");
          if (!targetRole.trim()) invalidFieldSet.add("targetRole");
        }
        const invalidFields = [...invalidFieldSet];
        setFieldErrors(invalidFields);
        setMessage(result.message ?? "We could not save that version.");
        if (invalidFields.length) {
          window.requestAnimationFrame(() => {
            editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
          });
        }
        return;
      }
      if (!result.item?.id) {
        setMessage("The version was saved, but we could not open it. Reload this page.");
        return;
      }
      router.replace(`${pathname}?version=${encodeURIComponent(result.item.id)}` as Route);
    } catch {
      setMessage("We could not save that version. Try again.");
    } finally {
      setPending(null);
    }
  }

  async function requestReview() {
    setPending("review");
    setMessage("");
    try {
      const response = await fetch(`/api/member/career-documents/${document.id}/reviews`, {
        body: JSON.stringify({
          modelConsent,
          providerNoticeVersion: configuration.noticeVersion,
          versionId: selected.id,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "We could not review that version.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("We could not review that version. Try again.");
    } finally {
      setModelConsent(false);
      setPending(null);
    }
  }

  return (
    <>
      {message && (
        <p className="error-summary" role="alert">
          {message}
        </p>
      )}
      <div className="document-version-toolbar">
        <label>
          Version
          <select
            disabled={pending !== null}
            onChange={(event) => chooseVersion(event.target.value)}
            value={selected.id}
          >
            {versionSummaries.map((version) => (
              <option key={version.id} value={version.id}>
                v{version.revision} · {version.label} · {versionDate(version.createdAt)}
              </option>
            ))}
          </select>
        </label>
        <p>
          {versionSummaries.length} immutable version
          {versionSummaries.length === 1 ? "" : "s"}. Saving always creates a new one.
        </p>
      </div>
      <div className="document-review-layout">
        <form
          className="document-editor"
          noValidate
          onSubmit={(event) => void saveVersion(event)}
          ref={editorRef}
        >
          <div className="document-editor-heading">
            <div>
              <p className="eyebrow">Editable working copy</p>
              <h2>{kindLabel} content</h2>
            </div>
            <span className="status">Based on v{selected.revision}</span>
          </div>
          <label>
            New version name
            <input
              aria-describedby={describeField("label")}
              aria-invalid={hasFieldError("label") || undefined}
              aria-label="New version name"
              disabled={pending === "save"}
              maxLength={160}
              onChange={(event) => {
                setLabel(event.target.value);
                clearFieldError("label");
                setDirty(true);
              }}
              required
              value={label}
            />
            {hasFieldError("label") && (
              <span className="field-error" id="career-version-label-error">
                {versionFieldMessages.label}
              </span>
            )}
          </label>
          <fieldset className="target-context-fields">
            <legend>Target role</legend>
            <label>
              Saved job
              <select
                aria-describedby={describeField("targetJobId")}
                aria-invalid={hasFieldError("targetJobId") || undefined}
                aria-label="Saved job"
                disabled={pending === "save"}
                onChange={(event) => updateTarget(event.target.value)}
                value={targetJobId}
              >
                <option value="">Paste a job description manually</option>
                {jobTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.roleTitle} · {target.companyName}
                  </option>
                ))}
              </select>
              {hasFieldError("targetJobId") && (
                <span className="field-error" id="career-version-targetJobId-error">
                  {versionFieldMessages.targetJobId}
                </span>
              )}
            </label>
            <label>
              Company
              <input
                aria-describedby={describeField("targetCompany")}
                aria-invalid={hasFieldError("targetCompany") || undefined}
                aria-label="Company"
                disabled={pending === "save"}
                maxLength={160}
                onChange={(event) => {
                  setTargetCompany(event.target.value);
                  setTargetJobId("");
                  clearFieldError("targetCompany");
                  setDirty(true);
                }}
                placeholder="Company name"
                value={targetCompany}
              />
              {hasFieldError("targetCompany") && (
                <span className="field-error" id="career-version-targetCompany-error">
                  {versionFieldMessages.targetCompany}
                </span>
              )}
            </label>
            <label>
              Role
              <input
                aria-describedby={describeField("targetRole")}
                aria-invalid={hasFieldError("targetRole") || undefined}
                aria-label="Role"
                disabled={pending === "save"}
                maxLength={160}
                onChange={(event) => {
                  setTargetRole(event.target.value);
                  setTargetJobId("");
                  clearFieldError("targetRole");
                  setDirty(true);
                }}
                placeholder="Role title"
                value={targetRole}
              />
              {hasFieldError("targetRole") && (
                <span className="field-error" id="career-version-targetRole-error">
                  {versionFieldMessages.targetRole}
                </span>
              )}
            </label>
          </fieldset>
          <label>
            Job description
            <textarea
              aria-describedby={describeField("jobDescription")}
              aria-invalid={hasFieldError("jobDescription") || undefined}
              aria-label="Job description"
              className="job-description-input"
              disabled={pending === "save"}
              maxLength={30_000}
              onChange={(event) => {
                setJobDescription(event.target.value);
                setTargetJobId("");
                clearFieldError("jobDescription");
                setDirty(true);
              }}
              placeholder="Paste the complete job description here. Treat employer content as untrusted and check it against the original posting."
              value={jobDescription}
            />
            {hasFieldError("jobDescription") && (
              <span className="field-error" id="career-version-jobDescription-error">
                {versionFieldMessages.jobDescription}
              </span>
            )}
          </label>
          <label>
            Extracted {kindLabel} text
            <textarea
              aria-describedby={describeField("contentText")}
              aria-invalid={hasFieldError("contentText") || undefined}
              aria-label={`Extracted ${kindLabel} text`}
              className="document-content-input"
              disabled={pending === "save"}
              maxLength={60_000}
              minLength={40}
              onChange={(event) => {
                setContentText(event.target.value);
                clearFieldError("contentText");
                setDirty(true);
              }}
              required
              value={contentText}
            />
            {hasFieldError("contentText") && (
              <span className="field-error" id="career-version-contentText-error">
                {versionFieldMessages.contentText}
              </span>
            )}
          </label>
          <p className="hint">
            Verify this reading order against your original document. Formatting, columns, images
            and visual spacing are not preserved here.
          </p>
          <button disabled={pending !== null || !dirty} type="submit">
            {pending === "save" ? "Saving version…" : "Save as a new version"}
          </button>
        </form>
        <aside className="document-review-panel" aria-labelledby="document-review-title">
          <p className="eyebrow">OfferLab document coach</p>
          <h2 id="document-review-title">Review for this job</h2>
          <p>
            See which role requirements your document evidences, which gaps matter most and what to
            improve next. The evidence score is not an ATS score or prediction of an interview.
          </p>
          {configuration.modelAvailable ? (
            <div className="career-model-notice">
              <label className="coach-consent">
                <input
                  checked={modelConsent}
                  onChange={(event) => setModelConsent(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Send this version and its job description to the configured DeepSeek API for this
                  review. Contact details are removed where detected. Provider processing remains
                  subject to the notice version shown below.
                </span>
              </label>
              <p className="hint">Notice: {configuration.noticeVersion}</p>
            </div>
          ) : (
            <p className="status">Private deterministic review · no model provider</p>
          )}
          {!membershipActive && (
            <p className="membership-prompt">
              Membership doubles your monthly review capacity.{" "}
              <a href="/member/membership">Compare plans →</a>
            </p>
          )}
          {dirty && (
            <p className="status">Save this working copy as a new version before reviewing it.</p>
          )}
          <button
            disabled={
              pending !== null ||
              dirty ||
              !selected.jobDescription ||
              (configuration.modelAvailable && !modelConsent)
            }
            onClick={() => void requestReview()}
            type="button"
          >
            {pending === "review" ? "Reviewing…" : `Review ${kindLabel} for this job`}
          </button>
          {!selected.jobDescription && (
            <p className="hint">Create a targeted version with a job description first.</p>
          )}
          {latestReview ? (
            <div className="career-review-result">
              <div className="career-review-meta">
                <strong>
                  {latestReview.providerMode === "model"
                    ? "AI review"
                    : latestReview.providerMode === "fallback"
                      ? "Local fallback"
                      : "Local review"}
                </strong>
                <span>{versionDate(latestReview.createdAt)}</span>
              </div>
              <p>{latestReview.summary}</p>
              {coverage && coverage.assessed > 0 && (
                <section className="career-evidence-score" aria-labelledby="evidence-score-title">
                  <div>
                    <p className="eyebrow" id="evidence-score-title">
                      Document evidence coverage
                    </p>
                    <p className="career-score-value">
                      {coverage.score}
                      <span>/100</span>
                    </p>
                  </div>
                  <div>
                    <strong>{coverage.label}</strong>
                    <p>
                      {coverage.evidenced} of {coverage.assessed} assessed requirements have
                      supporting evidence in this version.
                    </p>
                    <p className="hint">
                      This measures this document against the supplied job description. It does not
                      estimate your overall suitability or likelihood of an interview.
                    </p>
                  </div>
                </section>
              )}
              <section>
                <h3>Priority changes</h3>
                <ol className="career-review-actions">
                  {latestReview.priorityActions.map((action, index) => (
                    <li key={`${action.category}-${index}`}>
                      <strong>{action.category}</strong>
                      <p>{action.observation}</p>
                      <p>{action.suggestion}</p>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="career-requirements" aria-labelledby="requirements-title">
                <div className="career-section-heading">
                  <h3 id="requirements-title">Key role requirements</h3>
                  {coverage && coverage.assessed > 0 && <span>{coverage.assessed} assessed</span>}
                </div>
                {latestReview.matchedRequirements.map((requirement) => {
                  const strength = latestReview.strengths.find((candidate) =>
                    sameRequirement(candidate.requirement, requirement),
                  );
                  return (
                    <article className="career-requirement is-evidenced" key={requirement}>
                      <div className="career-requirement-heading">
                        <strong>{requirement}</strong>
                        <span>Evidence found</span>
                      </div>
                      <p>
                        <b>{document.kind === "cv" ? "CV evidence" : "Cover-letter evidence"}:</b>{" "}
                        {strength?.evidence ??
                          "Relevant wording is present. Add a concrete action and outcome to make the evidence easier to assess."}
                      </p>
                      <p className="hint">
                        Keep this evidence prominent and make your individual contribution clear.
                      </p>
                    </article>
                  );
                })}
                {latestReview.missingRequirements.map((requirement) => {
                  const recommendation = learning.find(({ gap }) =>
                    sameRequirement(gap, requirement),
                  );
                  return (
                    <article className="career-requirement is-gap" key={requirement}>
                      <div className="career-requirement-heading">
                        <strong>{requirement}</strong>
                        <span>Evidence gap</span>
                      </div>
                      <p>
                        <b>How to improve:</b>{" "}
                        {recommendation?.project ??
                          "If you have done this, add one truthful action–method–outcome example. If not, build a small project or seek an opportunity that produces evidence you can explain and show."}
                      </p>
                    </article>
                  );
                })}
                {!coverage?.assessed && (
                  <p className="hint">
                    The review could not isolate clear requirements. Check that the complete job
                    description was saved, then request a new review.
                  </p>
                )}
              </section>
              {learning.length > 0 && (
                <section className="career-development" aria-labelledby="development-title">
                  <h3 id="development-title">Build the missing evidence</h3>
                  <p>
                    A course can teach a skill, but your CV becomes stronger when you can show what
                    you made, analysed or improved with it.
                  </p>
                  <div className="career-development-list">
                    {learning.map((recommendation) => (
                      <article key={recommendation.skill}>
                        <strong>{recommendation.skill}</strong>
                        <p>{recommendation.project}</p>
                        <div className="career-development-links">
                          <Link href={recommendation.offerLab.path as Route}>
                            {recommendation.offerLab.label}
                          </Link>
                          {recommendation.external && (
                            <a
                              href={recommendation.external.url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {recommendation.external.label} · {recommendation.external.provider}
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="hint">
                    External options are curated starting points. OfferLab currently receives no
                    commission; check the provider’s current syllabus, price and terms before
                    enrolling.
                  </p>
                </section>
              )}
              <details>
                <summary>Document checks</summary>
                <dl className="document-checks">
                  {Object.entries(latestReview.documentChecks).map(([name, value]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              {reviews.length > 1 && (
                <details>
                  <summary>{reviews.length - 1} previous review(s) for this version</summary>
                  <ul>
                    {reviews.slice(1).map((review) => (
                      <li key={review.id}>
                        {versionDate(review.createdAt)} · {review.summary}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="career-review-empty">
              <h3>No review for this version</h3>
              <p>Save a target job description, then request one explicit review.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
