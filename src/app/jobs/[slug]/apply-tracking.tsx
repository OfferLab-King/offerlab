"use client";

import { useCallback } from "react";

export function ApplyTrackingLink({
  applicationUrl,
  label = "Apply on employer website",
}: Readonly<{ applicationUrl: string; label?: string }>) {
  const track = useCallback(() => {
    void fetch("/api/jobs/events", {
      body: JSON.stringify({ event: "employer_apply_click" }),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
  }, []);

  return (
    <a
      className="button-link apply-external-link"
      href={applicationUrl}
      onClick={track}
      rel="nofollow noopener noreferrer"
      target="_blank"
    >
      {label}
      <span aria-hidden="true" className="external-link-indicator">
        ↗
      </span>
    </a>
  );
}
