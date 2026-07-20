"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: Readonly<{ children: string }>) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit">
      {pending ? "Please wait…" : children}
    </button>
  );
}
