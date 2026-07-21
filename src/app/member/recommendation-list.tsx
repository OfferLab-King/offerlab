"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { MemberRecommendation } from "../../modules/recommendations/application/recommendations";

type RecommendationState = MemberRecommendation["state"];

type ApplicationLink = Readonly<{ href: string; label: string }>;

type Props = Readonly<{
  applicationLinks?: Readonly<Record<string, ApplicationLink>>;
  recommendations: readonly MemberRecommendation[];
  showApplicationLinks?: boolean;
  showSecondary?: boolean;
}>;

function token(recommendation: MemberRecommendation): string {
  return `${recommendation.identity.applicationId}-${recommendation.identity.key}-${recommendation.identity.ruleVersion}`;
}

function stateLabel(state: RecommendationState): string {
  if (state === "completed") return "Completed";
  if (state === "dismissed") return "Dismissed";
  return "Pending";
}

export function RecommendationList({
  applicationLinks = {},
  recommendations,
  showApplicationLinks = false,
  showSecondary = false,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(recommendations);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDismiss, setConfirmingDismiss] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const status = useRef<HTMLDivElement>(null);
  const dismissConfirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusRequest > 0) status.current?.focus();
  }, [focusRequest]);
  useEffect(() => {
    if (confirmingDismiss) dismissConfirm.current?.focus();
  }, [confirmingDismiss]);

  async function changeState(
    recommendation: MemberRecommendation,
    targetState: RecommendationState,
  ) {
    const itemToken = token(recommendation);
    setBusy(itemToken);
    setMessage("");
    setConflict(false);
    try {
      const response = await fetch(
        `/api/member/applications/${recommendation.identity.applicationId}/recommendations`,
        {
          body: JSON.stringify({
            expectedVersion: recommendation.stateVersion,
            recommendationKey: recommendation.identity.key,
            ruleVersion: recommendation.identity.ruleVersion,
            targetState,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const result = (await response.json()) as {
        outcome?: string;
        stateVersion?: number | null;
      };
      if (response.status === 409) {
        setConflict(true);
        setMessage(
          result.outcome === "not_applicable"
            ? "This recommendation is no longer available. Reload to see the current next actions."
            : "This recommendation changed elsewhere. Reload before trying again.",
        );
        setFocusRequest((current) => current + 1);
        return;
      }
      if (!response.ok) {
        setMessage("We could not update this recommendation. Please try again.");
        setFocusRequest((current) => current + 1);
        return;
      }

      setItems((current) =>
        current.map((item) =>
          token(item) === itemToken
            ? {
                ...item,
                state: targetState,
                stateVersion: typeof result.stateVersion === "number" ? result.stateVersion : null,
              }
            : item,
        ),
      );
      setConfirmingDismiss(null);
      setMessage(
        result.outcome === "unchanged"
          ? `“${recommendation.title}” is already ${stateLabel(targetState).toLowerCase()}.`
          : targetState === "pending"
            ? `“${recommendation.title}” was restored to pending.`
            : `“${recommendation.title}” was marked ${stateLabel(targetState).toLowerCase()}.`,
      );
      setFocusRequest((current) => current + 1);
      router.refresh();
    } catch {
      setMessage("We could not update this recommendation. Please try again.");
      setFocusRequest((current) => current + 1);
    } finally {
      setBusy(null);
    }
  }

  function card(recommendation: MemberRecommendation) {
    const itemToken = token(recommendation);
    const applicationLink = applicationLinks[recommendation.identity.applicationId];
    const isBusy = busy === itemToken;
    return (
      <article className="recommendation-card">
        <div className="recommendation-card-heading">
          <div>
            <p className={`urgency urgency-${recommendation.urgency}`}>
              Urgency: {recommendation.urgency}
            </p>
            <h3>{recommendation.title}</h3>
          </div>
          {recommendation.state !== "pending" && (
            <span className="state-badge">{stateLabel(recommendation.state)}</span>
          )}
        </div>
        {showApplicationLinks && applicationLink && (
          <p className="recommendation-application">
            Application: <a href={applicationLink.href}>{applicationLink.label}</a>
          </p>
        )}
        <p className="recommendation-guidance">{recommendation.guidance}</p>
        <p className="recommendation-explanation">{recommendation.explanation}</p>
        <div className="recommendation-actions">
          {recommendation.state === "pending" ? (
            <>
              <button
                aria-label={recommendation.accessibilityLabels.complete}
                disabled={busy !== null}
                onClick={() => void changeState(recommendation, "completed")}
                type="button"
              >
                {isBusy ? "Updating…" : "Mark completed"}
              </button>
              <button
                aria-label={recommendation.accessibilityLabels.dismiss}
                className="button-secondary"
                disabled={busy !== null}
                id={`dismiss-${itemToken}`}
                onClick={() => setConfirmingDismiss(itemToken)}
                type="button"
              >
                Dismiss
              </button>
            </>
          ) : (
            <button
              aria-label={recommendation.accessibilityLabels.restore}
              className="button-secondary"
              disabled={busy !== null}
              onClick={() => void changeState(recommendation, "pending")}
              type="button"
            >
              {isBusy ? "Restoring…" : "Restore to pending"}
            </button>
          )}
        </div>
        {confirmingDismiss === itemToken && (
          <div
            aria-labelledby={`dismiss-title-${itemToken}`}
            className="dismiss-confirmation"
            role="alertdialog"
          >
            <h4 id={`dismiss-title-${itemToken}`}>Dismiss this recommendation?</h4>
            <p>It will move out of your pending actions. You can restore it later.</p>
            <div className="recommendation-actions">
              <button
                aria-label={`Confirm dismissal of “${recommendation.title}”.`}
                disabled={busy !== null}
                onClick={() => void changeState(recommendation, "dismissed")}
                ref={dismissConfirm}
                type="button"
              >
                Confirm dismissal
              </button>
              <button
                className="button-secondary"
                disabled={busy !== null}
                onClick={() => {
                  setConfirmingDismiss(null);
                  requestAnimationFrame(() =>
                    document.getElementById(`dismiss-${itemToken}`)?.focus(),
                  );
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </article>
    );
  }

  const pending = items.filter(({ state }) => state === "pending");
  const completed = items.filter(({ state }) => state === "completed");
  const dismissed = items.filter(({ state }) => state === "dismissed");

  return (
    <div className="recommendations">
      {message && (
        <div
          aria-live={conflict ? "assertive" : "polite"}
          className={conflict ? "error-summary" : "status"}
          ref={status}
          role={conflict ? "alert" : "status"}
          tabIndex={-1}
        >
          <p>{message}</p>
          {conflict && (
            <button onClick={() => window.location.reload()} type="button">
              Reload recommendations
            </button>
          )}
        </div>
      )}
      {pending.length > 0 ? (
        <div className="recommendation-grid">
          {pending.map((item) => (
            <div key={token(item)}>{card(item)}</div>
          ))}
        </div>
      ) : (
        <p className="status">You have no pending recommendations here.</p>
      )}
      {showSecondary && completed.length > 0 && (
        <details className="recommendation-history">
          <summary>Completed recommendations ({completed.length})</summary>
          <div className="recommendation-grid">
            {completed.map((item) => (
              <div key={token(item)}>{card(item)}</div>
            ))}
          </div>
        </details>
      )}
      {showSecondary && dismissed.length > 0 && (
        <details className="recommendation-history">
          <summary>Dismissed recommendations ({dismissed.length})</summary>
          <div className="recommendation-grid">
            {dismissed.map((item) => (
              <div key={token(item)}>{card(item)}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
