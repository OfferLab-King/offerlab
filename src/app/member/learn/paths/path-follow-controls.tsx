"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PathFollowControls({
  following,
  pathId,
  quiet = false,
}: {
  following: boolean;
  pathId: string;
  quiet?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();
  return (
    <div className={quiet ? "following-control following-control-quiet" : "following-control"}>
      {following && <span className="following-status">Following</span>}
      <button
        className={quiet ? "text-action" : undefined}
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
              setStatus(following ? "Plan stopped." : "Plan started.");
              router.refresh();
            } catch {
              setStatus("The plan could not be updated. Please try again.");
            } finally {
              setPending(false);
            }
          })();
        }}
        type="button"
      >
        {pending ? "Updating…" : following ? "Stop following" : "Start this plan"}
      </button>
      <span aria-live="polite" className="status" role="status">
        {status}
      </span>
    </div>
  );
}
