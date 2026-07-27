"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ResourceStateControls({
  backToPlanHref,
  completed,
  completionHref,
  inPlan,
  resourceId,
  saved,
}: {
  backToPlanHref?: string;
  completed: boolean;
  completionHref?: string;
  inPlan: boolean;
  resourceId: string;
  saved: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: string) {
    setBusy(true);
    const response = await fetch(`/api/member/resources/${resourceId}/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = (await response.json()) as { outcome?: string };
    setMessage(
      response.ok
        ? result.outcome === "unchanged"
          ? "No change needed."
          : "Resource updated."
        : "We could not update this resource.",
    );
    setBusy(false);
    if (response.ok && action === "complete" && completionHref)
      router.push(completionHref as never);
    else if (response.ok) router.refresh();
  }
  return (
    <section
      className={`resource-actions${inPlan ? " resource-actions-plan" : ""}`}
      aria-label="Resource actions"
    >
      <div className="resource-action-controls">
        {inPlan && backToPlanHref && <a href={backToPlanHref}>Back to plan</a>}
        <button
          className="button-secondary"
          disabled={busy}
          onClick={() => void act(saved ? "unsave" : "save")}
        >
          {saved ? "Unsave" : "Save resource"}
        </button>
        <button
          className={completed ? "button-secondary" : undefined}
          disabled={busy}
          onClick={() => void act(completed ? "incomplete" : "complete")}
        >
          {completed ? "Mark incomplete" : inPlan ? "Mark complete and continue" : "Mark complete"}
        </button>
        {completed && <strong className="resource-completed">✓ Completed</strong>}
      </div>
      <p aria-live="polite" className="resource-action-message">
        {message}
      </p>
    </section>
  );
}
