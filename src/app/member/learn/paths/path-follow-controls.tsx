"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PathFollowControls({ following, pathId }: { following: boolean; pathId: string }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        disabled={pending}
        onClick={() => {
          void (async () => {
            setPending(true);
            setStatus("");
            try {
              const response = await fetch(`/api/member/learning-paths/${pathId}/state`, {
                body: JSON.stringify({ follow: !following }),
                headers: { "content-type": "application/json" },
                method: "PUT",
              });
              if (!response.ok) throw new Error("request failed");
              setStatus(following ? "Path stopped." : "Path started.");
              router.refresh();
            } catch {
              setStatus("The path could not be updated. Please try again.");
            } finally {
              setPending(false);
            }
          })();
        }}
        type="button"
      >
        {pending ? "Updating…" : following ? "Stop following" : "Start this path"}
      </button>
      <span aria-live="polite" className="status" role="status">
        {status}
      </span>
    </div>
  );
}
