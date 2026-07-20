"use client";

import { useState } from "react";

export function UpdatePasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const password = String(new FormData(event.currentTarget).get("password") ?? "");
        void fetch("/api/auth/update-password", {
          body: JSON.stringify({ password }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).then(async (response) => {
          if (!response.ok) {
            setError(
              "We could not update your password. Request a new recovery link and try again.",
            );
            setPending(false);
            return;
          }
          window.location.assign("/sign-in?password-reset=1");
        });
      }}
    >
      {error && (
        <p aria-live="polite" className="status">
          {error}
        </p>
      )}
      <label htmlFor="password">New password</label>
      <input
        autoComplete="new-password"
        id="password"
        minLength={10}
        name="password"
        required
        type="password"
      />
      <button disabled={pending} type="submit">
        {pending ? "Please wait…" : "Set new password"}
      </button>
    </form>
  );
}
