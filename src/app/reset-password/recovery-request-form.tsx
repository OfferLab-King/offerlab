"use client";

import { useState } from "react";

export function RecoveryRequestForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        const email = String(new FormData(event.currentTarget).get("email") ?? "");
        void fetch("/api/auth/recovery", {
          body: JSON.stringify({ email }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).then(async (response) => {
          const result = (await response.json()) as { message?: string };
          setMessage(
            result.message ??
              "If an eligible account exists, recovery instructions have been sent.",
          );
          setPending(false);
        });
      }}
    >
      {message && <p className="status">{message}</p>}
      <label htmlFor="email">Email</label>
      <input autoComplete="email" id="email" name="email" required type="email" />
      <button disabled={pending} type="submit">
        {pending ? "Please wait…" : "Send reset link"}
      </button>
    </form>
  );
}
