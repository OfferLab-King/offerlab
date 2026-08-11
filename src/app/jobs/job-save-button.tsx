"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JobSaveButton({
  jobId,
  initiallySaved = false,
}: Readonly<{ jobId: string; initiallySaved?: boolean }>) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleToggle(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/member/saved-jobs", {
        body: JSON.stringify({ jobId }),
        headers: { "content-type": "application/json" },
        method: saved ? "DELETE" : "POST",
      });
      if (response.status === 401) {
        router.push("/sign-in?next=/jobs");
        return;
      }
      if (!response.ok) {
        setMessage("We could not update your saved jobs. Please try again.");
        return;
      }
      setSaved(!saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="job-save-button-wrap">
      <button
        aria-label={saved ? "Unsave this role" : "Save this role"}
        aria-pressed={saved}
        className={`job-save-button ${saved ? "job-save-button-active" : ""}`}
        disabled={busy}
        onClick={() => {
          void handleToggle();
        }}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill={saved ? "currentColor" : "none"}
          height="16"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="16"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
      {message && (
        <span className="job-save-message" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}
