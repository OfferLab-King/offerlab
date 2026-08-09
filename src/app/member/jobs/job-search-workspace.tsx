"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import type {
  JobSearchDatePosted,
  JobSearchEmploymentType,
  JobSearchListing,
  JobSearchResult,
} from "../../../modules/job-discovery/domain/job-search";

export type JobTargetView = Readonly<{
  applyUrl: string | null;
  companyName: string;
  description: string;
  employmentType: string | null;
  fetchedAt: string | null;
  id: string;
  location: string | null;
  provider: "manual" | "jsearch";
  providerJobId: string | null;
  publishedAt: string | null;
  roleTitle: string;
  sourcePublisher: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}>;

type JsonObject = Readonly<Record<string, unknown>>;

type SearchCriteria = Readonly<{
  datePosted: JobSearchDatePosted;
  employmentTypes: readonly JobSearchEmploymentType[];
  jobRequirements: readonly [];
  location: string;
  remoteOnly: boolean;
  role: string;
}>;

const employmentOptions: readonly Readonly<{
  label: string;
  value: JobSearchEmploymentType;
}>[] = [
  { label: "Full-time", value: "FULLTIME" },
  { label: "Internship", value: "INTERN" },
  { label: "Part-time", value: "PARTTIME" },
  { label: "Contract", value: "CONTRACTOR" },
];

const dateOptions: readonly Readonly<{ label: string; value: JobSearchDatePosted }>[] = [
  { label: "Any time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Past 3 days", value: "3days" },
  { label: "Past week", value: "week" },
  { label: "Past month", value: "month" },
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<JsonObject> {
  try {
    const payload: unknown = await response.json();
    return isObject(payload) ? payload : {};
  } catch {
    return {};
  }
}

function responseMessage(payload: JsonObject, fallback: string): string {
  return typeof payload.message === "string" ? payload.message : fallback;
}

function readableEmploymentType(value: string | null): string | null {
  if (!value) return null;
  const known = employmentOptions.find((option) => option.value === value);
  if (known) return known.label;
  return value
    .toLocaleLowerCase("en-GB")
    .replaceAll("_", " ")
    .replace(/^./u, (letter) => letter.toLocaleUpperCase("en-GB"));
}

function readableDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return null;
  return date.toLocaleDateString("en-GB", { dateStyle: "medium" });
}

function resultSaveProblem(job: JobSearchListing): string | null {
  if (!job.description?.trim()) return "The provider did not include a job description.";
  if (job.description.trim().length > 30_000)
    return "The returned job description is too long to save safely.";
  if (job.title.length > 160 || job.employerName.length > 160)
    return "The returned role or company name is too long to save safely.";
  if ((job.location?.length ?? 0) > 200) return "The returned location is too long to save safely.";
  if (job.id.length > 500) return "The provider job identifier is too long to save safely.";
  if (job.publisher.length > 160) return "The returned publisher name is too long to save safely.";
  return null;
}

function externalLink(url: string, label: string) {
  return (
    <a
      aria-label={`${label} (opens in a new tab)`}
      className="button-link button-secondary"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

function addOrReplaceTarget(
  targets: readonly JobTargetView[],
  nextTarget: JobTargetView,
): readonly JobTargetView[] {
  return [nextTarget, ...targets.filter((target) => target.id !== nextTarget.id)];
}

export function JobSearchWorkspace({
  initialTargets,
}: {
  initialTargets: readonly JobTargetView[];
}) {
  const roleId = useId();
  const locationId = useId();
  const dateId = useId();
  const manualRoleId = useId();
  const manualCompanyId = useId();
  const manualLocationId = useId();
  const manualEmploymentId = useId();
  const manualDescriptionId = useId();
  const manualLinkId = useId();

  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [datePosted, setDatePosted] = useState<JobSearchDatePosted>("all");
  const [employmentTypes, setEmploymentTypes] = useState<readonly JobSearchEmploymentType[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [results, setResults] = useState<readonly JobSearchListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState<SearchCriteria | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchNotice, setSearchNotice] = useState("");
  const [targets, setTargets] = useState(initialTargets);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [resultSaveError, setResultSaveError] = useState("");
  const [manualPending, setManualPending] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualNotice, setManualNotice] = useState("");

  const savedProviderIds = useMemo(
    () =>
      new Set(
        targets
          .filter((target) => target.provider === "jsearch" && target.providerJobId)
          .map((target) => target.providerJobId),
      ),
    [targets],
  );

  function changeEmployment(event: ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.value as JobSearchEmploymentType;
    setEmploymentTypes((current) =>
      event.currentTarget.checked
        ? [...new Set([...current, value])]
        : current.filter((item) => item !== value),
    );
  }

  async function runSearch(criteria: SearchCriteria, cursor?: string) {
    setSearchPending(true);
    setSearchError("");
    setSearchNotice("");
    try {
      const response = await fetch("/api/member/jobs/search", {
        body: JSON.stringify({
          ...(cursor ? { cursor } : {}),
          ...criteria,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await readJson(response);
      if (!response.ok) {
        setSearchError(responseMessage(payload, "Job search is unavailable. Try again later."));
        return;
      }
      const searchResult = payload as Partial<JobSearchResult>;
      if (!Array.isArray(searchResult.jobs)) {
        setSearchError("Job search returned an unexpected response. Try again later.");
        return;
      }
      const received = searchResult.jobs;
      setResults((current) => {
        if (!cursor) return received;
        const known = new Set(current.map((job) => job.id));
        return [...current, ...received.filter((job) => !known.has(job.id))];
      });
      setNextCursor(typeof searchResult.nextCursor === "string" ? searchResult.nextCursor : null);
      if (!cursor) setActiveSearch(criteria);
      setHasSearched(true);
      setSearchNotice(
        received.length
          ? `${received.length} ${cursor ? "more " : ""}role${received.length === 1 ? "" : "s"} found.`
          : cursor
            ? "No more roles were returned."
            : "No roles matched this search. Try a broader role or location.",
      );
    } catch {
      setSearchError("Job search is unavailable. Try again later or add the role manually.");
    } finally {
      setSearchPending(false);
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResults([]);
    setNextCursor(null);
    setHasSearched(false);
    await runSearch({
      datePosted,
      employmentTypes,
      jobRequirements: [],
      location,
      remoteOnly,
      role,
    });
  }

  async function saveResult(job: JobSearchListing) {
    const saveProblem = resultSaveProblem(job);
    if (saveProblem) {
      setResultSaveError(saveProblem);
      return;
    }
    setSavingResultId(job.id);
    setResultSaveError("");
    try {
      const employmentType =
        job.employmentType && job.employmentType.length <= 80
          ? job.employmentType
          : (job.employmentTypes[0] ?? null);
      const response = await fetch("/api/member/jobs", {
        body: JSON.stringify({
          applyUrl: job.applyUrl,
          companyName: job.employerName,
          description: job.description,
          employmentType,
          fetchedAt: new Date().toISOString(),
          location: job.location,
          provider: "jsearch",
          providerJobId: job.id,
          publishedAt: job.postedAtUtc,
          roleTitle: job.title,
          sourcePublisher: job.publisher,
          sourceUrl: job.applyUrl,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await readJson(response);
      if (!response.ok || !isObject(payload.item)) {
        setResultSaveError(responseMessage(payload, "We could not save that role. Try again."));
        return;
      }
      setTargets((current) => addOrReplaceTarget(current, payload.item as JobTargetView));
    } catch {
      setResultSaveError("We could not save that role. Try again.");
    } finally {
      setSavingResultId(null);
    }
  }

  async function saveManualTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setManualPending(true);
    setManualError("");
    setManualNotice("");
    const form = new FormData(formElement);
    const optional = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" && value.trim() ? value.trim() : null;
    };
    const sourceUrl = optional("sourceUrl");
    try {
      const response = await fetch("/api/member/jobs", {
        body: JSON.stringify({
          applyUrl: sourceUrl,
          companyName: form.get("companyName"),
          description: form.get("description"),
          employmentType: optional("employmentType"),
          fetchedAt: null,
          location: optional("location"),
          provider: "manual",
          providerJobId: null,
          publishedAt: null,
          roleTitle: form.get("roleTitle"),
          sourcePublisher: null,
          sourceUrl,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await readJson(response);
      if (!response.ok || !isObject(payload.item)) {
        setManualError(responseMessage(payload, "Check the job details and try again."));
        return;
      }
      setTargets((current) => addOrReplaceTarget(current, payload.item as JobTargetView));
      formElement.reset();
      setManualNotice("Role saved to your private targets.");
    } catch {
      setManualError("We could not save that role. Try again.");
    } finally {
      setManualPending(false);
    }
  }

  return (
    <>
      <section aria-labelledby="search-jobs-title" className="career-document-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Search vacancies</p>
            <h2 id="search-jobs-title">Search by role and location</h2>
          </div>
        </div>
        <form className="library-filters" onSubmit={(event) => void submitSearch(event)}>
          <div className="primary-filters">
            <label htmlFor={roleId}>
              Role or keywords
              <input
                id={roleId}
                maxLength={120}
                minLength={2}
                onChange={(event) => setRole(event.currentTarget.value)}
                placeholder="Graduate software developer"
                required
                value={role}
              />
            </label>
            <label htmlFor={locationId}>
              Location
              <input
                id={locationId}
                maxLength={120}
                minLength={2}
                onChange={(event) => setLocation(event.currentTarget.value)}
                placeholder="London"
                required
                value={location}
              />
            </label>
            <label htmlFor={dateId}>
              Date posted
              <select
                id={dateId}
                onChange={(event) =>
                  setDatePosted(event.currentTarget.value as JobSearchDatePosted)
                }
                value={datePosted}
              >
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={searchPending} type="submit">
              {searchPending ? "Searching…" : "Search jobs"}
            </button>
          </div>
          <details className="more-filters">
            <summary>More filters</summary>
            <div className="secondary-filters">
              <fieldset>
                <legend>Employment type</legend>
                <div className="choice-grid">
                  {employmentOptions.map((option) => (
                    <label className="choice" key={option.value}>
                      <input
                        checked={employmentTypes.includes(option.value)}
                        onChange={changeEmployment}
                        type="checkbox"
                        value={option.value}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Working arrangement</legend>
                <label className="choice">
                  <input
                    checked={remoteOnly}
                    onChange={(event) => setRemoteOnly(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  Remote roles only
                </label>
              </fieldset>
            </div>
          </details>
          <p className="hint">
            Search runs only when you submit this form. Results come from an external job-search
            provider; OfferLab does not scrape employer sites or send your CV to the provider.
          </p>
        </form>
        {searchError && (
          <div className="error-summary" role="alert">
            <p>{searchError}</p>
            <p>You can still save the vacancy using the manual form below.</p>
          </div>
        )}
        <p aria-live="polite" className={searchNotice ? "status" : "visually-hidden"}>
          {searchPending ? "Searching for jobs." : searchNotice}
        </p>
        {resultSaveError && (
          <p className="error-summary" role="alert">
            {resultSaveError}
          </p>
        )}
        {hasSearched && results.length > 0 && (
          <div aria-labelledby="job-results-title">
            <div className="section-heading-row">
              <h3 id="job-results-title">Search results</h3>
              <span className="application-count">{results.length} shown</span>
            </div>
            <ul className="application-list">
              {results.map((job) => {
                const saved = savedProviderIds.has(job.id);
                const saveProblem = resultSaveProblem(job);
                const posted = readableDate(job.postedAtUtc);
                const jobType = readableEmploymentType(
                  job.employmentType ?? job.employmentTypes[0] ?? null,
                );
                return (
                  <li className="application-card" key={job.id}>
                    <div>
                      <p className="application-company">{job.employerName}</p>
                      <h3>{job.title}</h3>
                      <p className="application-meta">
                        {[job.location, jobType, job.isRemote ? "Remote" : null]
                          .filter(Boolean)
                          .join(" · ") || "Location and work pattern not supplied"}
                      </p>
                      <p className="hint">
                        {[job.publisher, posted ? `Posted ${posted}` : job.postedAt]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {job.salaryText && <p>{job.salaryText}</p>}
                      {job.description && (
                        <details>
                          <summary>Read job description</summary>
                          <p>{job.description}</p>
                        </details>
                      )}
                      {saveProblem && <p className="hint">Cannot save: {saveProblem}</p>}
                    </div>
                    <div className="form-actions">
                      {externalLink(
                        job.applyUrl,
                        job.directApply ? "Apply on employer site" : "View job",
                      )}
                      <button
                        className="button-secondary"
                        disabled={saved || Boolean(saveProblem) || savingResultId !== null}
                        onClick={() => void saveResult(job)}
                        type="button"
                      >
                        {saved
                          ? "Saved"
                          : savingResultId === job.id
                            ? "Saving…"
                            : "Save as private target"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {nextCursor && activeSearch && (
              <button
                className="button-secondary"
                disabled={searchPending}
                onClick={() => void runSearch(activeSearch, nextCursor)}
                type="button"
              >
                {searchPending ? "Loading…" : "Show more results"}
              </button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="manual-target-title" className="career-document-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Add your own</p>
            <h2 id="manual-target-title">Save a role manually</h2>
            <p className="hint">
              Paste the employer’s job description so it is ready for CV and cover-letter tailoring.
              The role stays private to your account.
            </p>
          </div>
        </div>
        <form className="card guided-form" onSubmit={(event) => void saveManualTarget(event)}>
          {manualError && (
            <p className="error-summary" role="alert">
              {manualError}
            </p>
          )}
          {manualNotice && (
            <p aria-live="polite" className="success-summary">
              {manualNotice}
            </p>
          )}
          <div className="primary-filters">
            <label htmlFor={manualRoleId}>
              Role title
              <input id={manualRoleId} maxLength={160} name="roleTitle" required />
            </label>
            <label htmlFor={manualCompanyId}>
              Company
              <input id={manualCompanyId} maxLength={160} name="companyName" required />
            </label>
            <label htmlFor={manualLocationId}>
              Location <span className="hint">Optional</span>
              <input id={manualLocationId} maxLength={200} name="location" />
            </label>
          </div>
          <div className="primary-filters">
            <label htmlFor={manualEmploymentId}>
              Employment type <span className="hint">Optional</span>
              <select defaultValue="" id={manualEmploymentId} name="employmentType">
                <option value="">Select</option>
                {employmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={manualLinkId}>
              Job or application link <span className="hint">Optional</span>
              <input id={manualLinkId} name="sourceUrl" type="url" />
            </label>
          </div>
          <label htmlFor={manualDescriptionId}>
            Job description
            <textarea
              id={manualDescriptionId}
              maxLength={30_000}
              minLength={1}
              name="description"
              required
              rows={12}
            />
          </label>
          <button disabled={manualPending} type="submit">
            {manualPending ? "Saving…" : "Save private target"}
          </button>
        </form>
      </section>

      <section aria-labelledby="saved-targets-title" className="career-document-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Your role library</p>
            <h2 id="saved-targets-title">Saved targets</h2>
          </div>
          <span className="application-count">{targets.length} saved</span>
        </div>
        {targets.length ? (
          <ul className="material-list">
            {targets.map((target) => {
              const sourceUrl = target.sourceUrl ?? target.applyUrl;
              return (
                <li className="material-row" key={target.id}>
                  <div>
                    <p className="application-company">{target.companyName}</p>
                    <h3>{target.roleTitle}</h3>
                    <p className="application-meta">
                      {[target.location, readableEmploymentType(target.employmentType)]
                        .filter(Boolean)
                        .join(" · ") || "No location or employment type saved"}
                    </p>
                    <p className="hint">
                      {target.provider === "manual"
                        ? "Added manually"
                        : `Found via ${target.sourcePublisher ?? "external job search"}`}
                      {` · Saved ${readableDate(target.updatedAt) ?? "recently"}`}
                    </p>
                  </div>
                  <div className="form-actions">
                    {sourceUrl && externalLink(sourceUrl, "View source")}
                    <Link className="button-link button-secondary" href="/member/cvs">
                      Tailor a CV
                    </Link>
                    <Link className="button-link button-secondary" href="/member/cover-letters">
                      Tailor a cover letter
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card empty-state">
            <h3>No saved targets yet</h3>
            <p>Save a search result or add a role manually. It will appear here for reuse.</p>
          </div>
        )}
      </section>
    </>
  );
}
