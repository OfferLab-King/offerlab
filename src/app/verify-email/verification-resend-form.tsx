"use client";

import { useState } from "react";

export function VerificationResendForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        const email = String(new FormData(event.currentTarget).get("email") ?? "");
        void fetch("/api/auth/resend", {
          body: JSON.stringify({ email }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).then(async (response) => {
          const result = (await response.json()) as { message?: string };
          setMessage(
            result.message ?? "If the account is eligible, a verification message has been sent.",
          );
          setPending(false);
        });
      }}
    >
      {message && <p className="status">{message}</p>}
      <label htmlFor="resend-email">Email</label>
      <input autoComplete="email" id="resend-email" name="email" required type="email" />
      <button disabled={pending} type="submit">
        {pending ? "Please wait…" : "Resend verification"}
      </button>
    </form>
  );
}
