"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ResourceStateControls({
  completed,
  resourceId,
  saved,
}: {
  completed: boolean;
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
    if (response.ok) router.refresh();
  }
  return (
    <section className="card resource-actions" aria-label="Resource actions">
      <button disabled={busy} onClick={() => void act(saved ? "unsave" : "save")}>
        {saved ? "Unsave" : "Save resource"}
      </button>
      <button
        className="button-secondary"
        disabled={busy}
        onClick={() => void act(completed ? "incomplete" : "complete")}
      >
        {completed ? "Mark incomplete" : "Mark complete"}
      </button>
      <p aria-live="polite">{message}</p>
    </section>
  );
}
