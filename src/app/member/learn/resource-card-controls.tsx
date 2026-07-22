"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResourceCardControls({
  resourceId,
  saved,
}: {
  resourceId: string;
  saved: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function changeSavedState() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/member/resources/${resourceId}/state`, {
        body: JSON.stringify({ action: saved ? "unsave" : "save" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("request failed");
      setMessage(saved ? "Removed from saved resources." : "Resource saved.");
      router.refresh();
    } catch {
      setMessage("We could not update this resource.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="resource-card-save">
      <button className="button-secondary" disabled={busy} onClick={() => void changeSavedState()}>
        {busy ? "Updating…" : saved ? "Saved" : "Save"}
      </button>
      <span aria-live="polite" className="visually-hidden">
        {message}
      </span>
    </div>
  );
}
