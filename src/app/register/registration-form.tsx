"use client";

import { useState } from "react";

export function RegistrationForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const data = new FormData(event.currentTarget);
        void fetch("/api/auth/register", {
          body: JSON.stringify({
            email: data.get("email"),
            password: data.get("password"),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).then(async (response) => {
          const result = (await response.json()) as { message?: string; next?: string };
          if (!response.ok || !result.next) {
            setError(result.message ?? "We could not complete that request.");
            setPending(false);
            return;
          }
          window.location.assign(result.next);
        });
      }}
    >
      {error && (
        <p aria-live="polite" className="status">
          {error}
        </p>
      )}
      <label htmlFor="email">Email</label>
      <input autoComplete="email" id="email" name="email" required type="email" />
      <label htmlFor="password">Create password</label>
      <input
        autoComplete="new-password"
        id="password"
        minLength={10}
        name="password"
        required
        type="password"
      />
      <p className="hint">At least 10 characters with upper and lower case letters and a number.</p>
      <button disabled={pending} type="submit">
        {pending ? "Please wait…" : "Create account"}
      </button>
    </form>
  );
}
