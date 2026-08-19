"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SaveJobButton({
  initiallySaved,
  jobId,
}: Readonly<{ initiallySaved: boolean; jobId: string }>) {
  const router = useRouter();
  const pathname = usePathname();
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
        router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) {
        setMessage("We could not update your saved jobs. Please try again.");
        return;
      }
      setSaved(!saved);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="save-job-control">
      <button
        aria-pressed={saved}
        className="button-link secondary"
        disabled={busy}
        onClick={() => {
          void handleToggle();
        }}
        type="button"
      >
        {saved ? "Unsave role" : "Save role"}
      </button>
      {message && (
        <span className="job-save-message" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}
