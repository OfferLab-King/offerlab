"use client";

import { useMemo, useState } from "react";

import { eligibilityReasonLabels } from "../../../modules/job-catalog/domain/eligibility";
import type { EligibilityQueueRow } from "../../../modules/job-catalog/infrastructure/job-repository";
import { bulkEligibilityDecision, overrideEligibility, quickEligibilityDecision } from "./actions";

type EligibilityQueueProps = Readonly<{
  queue: readonly EligibilityQueueRow[];
}>;

const reasonTint: Readonly<Record<string, string>> = {
  location_ambiguous: "status-badge--warn",
  title_senior_signal: "status-badge--negative",
  description_senior_signal: "status-badge--negative",
  contradictory_evidence: "status-badge--negative",
  title_early_career: "status-badge--positive",
  uk_location: "status-badge--positive",
};

export function EligibilityReviewQueue({ queue }: EligibilityQueueProps) {
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [pending, setPending] = useState(false);

  const reasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of queue) {
      for (const reason of job.eligibility_reasons) {
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [queue]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return queue.filter((job) => {
      if (reasonFilter !== "all" && !job.eligibility_reasons.includes(reasonFilter)) return false;
      if (!query) return true;
      return (
        job.title.toLowerCase().includes(query) ||
        job.company_name.toLowerCase().includes(query) ||
        (job.location_text ?? "").toLowerCase().includes(query)
      );
    });
  }, [queue, reasonFilter, search]);

  const reviewable = filtered.filter((job) => job.eligibility_status === "needs_review");

  async function run(action: (formData: FormData) => Promise<void>, formData: FormData) {
    setPending(true);
    try {
      await action(formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="cms-review-queue">
      <div className="cms-filter-bar cms-review-filters">
        <label>
          Search jobs
          <input
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Company, role or location"
            type="search"
            value={search}
          />
        </label>
        <label>
          Filter by reason
          <select
            onChange={(event) => setReasonFilter(event.currentTarget.value)}
            value={reasonFilter}
          >
            <option value="all">All reasons ({queue.length})</option>
            {reasons.map(([reason, count]) => (
              <option key={reason} value={reason}>
                {eligibilityReasonLabels[reason as keyof typeof eligibilityReasonLabels] ?? reason}{" "}
                ({count})
              </option>
            ))}
          </select>
        </label>
        <div className="cms-filter-actions">
          {reviewable.length > 1 && (
            <form
              action={(formData) => void run(bulkEligibilityDecision, formData)}
              className="cms-bulk-form"
            >
              {reviewable.map((job) => (
                <input key={job.id} name="jobIds" type="hidden" value={job.id} />
              ))}
              <input name="decision" type="hidden" value="ineligible" />
              <button className="button-link secondary" disabled={pending} type="submit">
                Suppress {reviewable.length} filtered roles (non-UK)
              </button>
            </form>
          )}
          {reviewable.length > 1 && (
            <form
              action={(formData) => void run(bulkEligibilityDecision, formData)}
              className="cms-bulk-form"
            >
              {reviewable.map((job) => (
                <input key={job.id} name="jobIds" type="hidden" value={job.id} />
              ))}
              <input name="decision" type="hidden" value="eligible" />
              <button className="button-link" disabled={pending} type="submit">
                Approve {reviewable.length} filtered roles
              </button>
            </form>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="hint">No jobs match the current filters.</p>
      ) : (
        <ul className="cms-review-list">
          {filtered.map((job) => (
            <li className="cms-operation-card" key={job.id}>
              <div className="cms-job-source-head">
                <h3>{job.title}</h3>
                <span
                  className={`status-badge ${
                    job.eligibility_status === "ineligible" ? "status-badge--negative" : ""
                  }`}
                >
                  {job.eligibility_status === "needs_review" ? "Needs review" : "Ineligible"}
                </span>
              </div>
              <p>
                {job.company_name} · {job.opportunity_type}
                {job.location_text ? ` · ${job.location_text.slice(0, 120)}` : ""}
              </p>
              <ul className="cms-reason-list">
                {job.eligibility_reasons.map((reason) => (
                  <li key={reason}>
                    <span className={`status-badge ${reasonTint[reason] ?? ""}`}>
                      {eligibilityReasonLabels[reason as keyof typeof eligibilityReasonLabels] ??
                        reason}
                    </span>
                  </li>
                ))}
              </ul>
              {job.eligibility_evidence && (
                <p className="cms-review-evidence">&ldquo;{job.eligibility_evidence}&rdquo;</p>
              )}
              <div className="cms-job-source-state">
                {job.eligibility_status === "needs_review" && (
                  <>
                    <form action={(formData) => void run(quickEligibilityDecision, formData)}>
                      <input name="jobId" type="hidden" value={job.id} />
                      <input name="decision" type="hidden" value="eligible" />
                      <button className="button-link" disabled={pending} type="submit">
                        Approve
                      </button>
                    </form>
                    <form action={(formData) => void run(quickEligibilityDecision, formData)}>
                      <input name="jobId" type="hidden" value={job.id} />
                      <input name="decision" type="hidden" value="ineligible" />
                      <button className="button-link secondary" disabled={pending} type="submit">
                        Mark ineligible
                      </button>
                    </form>
                  </>
                )}
                <form action={overrideEligibility}>
                  <input name="jobId" type="hidden" value={job.id} />
                  <label>
                    <span className="visually-hidden">Eligibility decision</span>
                    <select
                      defaultValue={job.eligibility_status}
                      name="eligibilityStatus"
                      onChange={(event) => {
                        if (event.currentTarget.value === job.eligibility_status) return;
                        const form = event.currentTarget.form;
                        if (form) form.requestSubmit();
                      }}
                    >
                      <option value="eligible">Eligible</option>
                      <option value="needs_review">Needs review</option>
                      <option value="ineligible">Ineligible</option>
                    </select>
                  </label>
                  {job.application_url && (
                    <a className="hint" href={job.application_url} rel="noreferrer" target="_blank">
                      Open listing ↗
                    </a>
                  )}
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
