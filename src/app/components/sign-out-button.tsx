"use client";

import type { FormEvent } from "react";

export function SignOutButton() {
  async function signOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/auth/sign-out", { method: "POST" });
    if (response.redirected) window.location.assign(response.url);
  }

  return (
    <form action="/auth/sign-out" method="post" onSubmit={(event) => void signOut(event)}>
      <button type="submit">Sign out</button>
    </form>
  );
}
