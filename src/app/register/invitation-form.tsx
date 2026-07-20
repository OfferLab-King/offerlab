"use client";

import { useEffect, useRef, useState } from "react";

export function InvitationForm() {
  const invitationInput = useRef<HTMLInputElement>(null);
  const missingInvitation = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const invitation = parameters.get("invitation") ?? "";
    if (invitationInput.current) invitationInput.current.value = invitation;
    if (missingInvitation.current && invitation) missingInvitation.current.hidden = true;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  return (
    <>
      <p className="status" ref={missingInvitation}>
        Open the complete invitation link to register.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          const data = new FormData(event.currentTarget);
          void fetch("/api/auth/register", {
            body: JSON.stringify({
              email: data.get("email"),
              invitation: data.get("invitation"),
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
        {error && <p className="status">{error}</p>}
        <input name="invitation" ref={invitationInput} type="hidden" />
        <label htmlFor="email">Invited email</label>
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
        <p className="hint">
          At least 10 characters with upper and lower case letters and a number.
        </p>
        <button disabled={pending} type="submit">
          {pending ? "Please wait…" : "Create account"}
        </button>
      </form>
    </>
  );
}
