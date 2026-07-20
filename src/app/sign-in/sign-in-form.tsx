"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "../../infrastructure/supabase/browser";
import { safeRedirectPath } from "../../modules/identity-access/domain/redirect";

export function SignInForm({ next }: Readonly<{ next: string }>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const data = new FormData(event.currentTarget);
        void createSupabaseBrowserClient()
          .auth.signInWithPassword({
            email: String(data.get("email") ?? ""),
            password: String(data.get("password") ?? ""),
          })
          .then(async ({ error: signInError }) => {
            if (signInError) {
              setError("We could not sign you in with those details.");
              setPending(false);
              return;
            }
            window.location.assign(safeRedirectPath(next));
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
      <label htmlFor="password">Password</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />
      <button disabled={pending} type="submit">
        {pending ? "Please wait…" : "Sign in"}
      </button>
    </form>
  );
}
